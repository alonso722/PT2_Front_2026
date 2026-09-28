import { Component, OnInit } from '@angular/core';
import { NavBarComponent } from '../misc/navBar/nav-bar/nav-bar.component';
import { CommonModule } from '@angular/common';
import { SolicitudService } from '../services/solicitud.service';
import { NzMessageModule, NzMessageService } from 'ng-zorro-antd/message';
import { NzButtonModule } from 'ng-zorro-antd/button';
import axios from 'axios';
import { FormsModule } from '@angular/forms';

import { environment } from '../../environments/environment';

@Component({
  selector: 'app-details-page',
  standalone: true,
  imports: [CommonModule, NavBarComponent, FormsModule, NzMessageModule, NzButtonModule],
  templateUrl: './details-page.component.html',
  styleUrl: './details-page.component.css',
})
export class DetailsPageComponent implements OnInit {
  solicitud: any = null;
  mensualidadCreditosActivos: number = 0;
  creditsByRfc: any[] = [];
  esfuerzo: number = 0;
  esfuerzoAlto: boolean = false;
  Math = Math;

  totalGastos: number = 0;
  ingresoDisponible: number = 0;
  mensualidad: number = 0;

  iaResultado: number | null = null;
  iaMensaje: string = '';
  iaColor: string = '';
  relationEffortRejected = false;
  iaLoading = false;

  shapBase = 0.7;
  shapFinal = 0;
  shapValues: any[] = [];
  shapAccumulated: any[] = [];
  shapMin = 0;
  shapMax = 0;

  documentChecks: Record<string, boolean> = {
    domicile: false,
    birth: false,
    ine: false,
    guarantee: false,
    income:false
  };

  constructor(
    private solicitudService: SolicitudService,
    private message: NzMessageService
  ) {}

  async ngOnInit(): Promise<void> {

    this.solicitud = this.solicitudService.getSolicitud();
    console.log('Solicitud recibida en details-page:', this.solicitud);
    if (this.solicitud?.rfc) {
      await this.obtenerCreditosPorRfc();
    }

    const mensualidadActiva = this.creditsByRfc
      .filter(c => c.active)
      .reduce((sum, c) => sum + Number(c.monthly_payment || 0), 0);

    this.mensualidadCreditosActivos = mensualidadActiva;

    if (this.solicitud) {
      const integrantes = Number(this.solicitud.count_family_members || 1);
      const hijos = Number(this.solicitud.count_children || 0);

      // Mínimos estimados
      const MIN_COMIDA_POR_PERSONA = 2500;
      const MIN_SERVICIOS_POR_PERSONA = 500;
      const MIN_EDUCACION_POR_HIJO = 1500;

      const comidaMinima = integrantes * MIN_COMIDA_POR_PERSONA;
      const serviciosMinimos = integrantes * MIN_SERVICIOS_POR_PERSONA;
      const educacionMinima = hijos * MIN_EDUCACION_POR_HIJO;

      // Si declara menos del mínimo, sustituir
      this.solicitud.food_expenses = Math.max(
        Number(this.solicitud.food_expenses || 0),
        comidaMinima
      );

      this.solicitud.utilities_expenses = Math.max(
        Number(this.solicitud.utilities_expenses || 0),
        serviciosMinimos
      );

      this.solicitud.education_expenses = Math.max(
        Number(this.solicitud.education_expenses || 0),
        educacionMinima
      );

      console.log('Comida ajustada:', this.solicitud.food_expenses);
      console.log('Servicios ajustados:', this.solicitud.utilities_expenses);
      console.log('Educación ajustada:', this.solicitud.education_expenses);
      const ingresoMensual = this.solicitud.monthly_income;

      // <-- Aquí cambiamos const por this.
      this.totalGastos =
        Number(this.solicitud.food_expenses || 0) +
        Number(this.solicitud.education_expenses || 0) +
        Number(this.solicitud.transport_expenses || 0) +
        Number(this.solicitud.utilities_expenses || 0) +
        Number(this.solicitud.health_expenses || 0) +
        Number(this.solicitud.maintenance_expenses || 0) +
        Number(this.solicitud.rent_expenses || 0);
      this.ingresoDisponible = ingresoMensual - this.totalGastos - this.mensualidadCreditosActivos;

      this.mensualidad = this.solicitud.amount / this.solicitud.loan_term;
      console.log("--------------------------------",this.mensualidad, this.totalGastos, this.ingresoDisponible)
      this.esfuerzo = +((this.mensualidad / this.ingresoDisponible) * 100).toFixed(2);
      console.log('Relación de esfuerzo calculada:', this.esfuerzo);

      const tipo = this.solicitud.creditType?.toLowerCase();
      const id = this.solicitud.id;

      if (!this.solicitud.guarantee_type) {
        this.solicitud.guarantee_type = 3;
      }

      const hasDomicile = this.solicitud.has_domicile ? 'Casa' : 'Departamento';

      let occupationType: string;
      switch (this.solicitud.occupation_type) {
        case 0:
          occupationType = 'Empleado';
          break;
        case 1:
          occupationType = 'Estudiante';
          break;
        case 2:
          occupationType = 'Desempleado';
          break;
        default:
          occupationType = 'Ocupación desconocida';
          break;
      }

      let creditStatus = 'Desconocido';
      switch (this.solicitud.status) {
        case 1:
          creditStatus = 'Enviada';
          break;
        case 2:
          creditStatus = 'En revisión';
          break;
        case 3:
          creditStatus = 'Aprobada';
          break;
        case 4:
          creditStatus = 'Rechazada';
          break;
      }

      this.solicitud = {
        ...this.solicitud,
        creditStatus,
        hasDomicile,
        occupationType,
      };

      const rawToken = localStorage.getItem('accessToken');
      let token = '';
      if (rawToken) {
        try {
          const parsed = JSON.parse(rawToken);
          token = parsed._value || '';
        } catch (e) {
          token = rawToken;
        }
      }

      const docEndpoints = ['ine', 'birth', 'domicile', 'income'];
      for (const doc of docEndpoints) {
        try {
          const res = await axios.get(
            `${environment.DOCUMENTS_SERVICE_URL}/${this.solicitud.requester_id}/${doc}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          const url = res.data?.data?.url || null;
          if (url) {
            this.solicitud[`url_${doc}`] = url;
            console.log(`Documento ${doc} cargado:`, url);
          } else {
            console.warn(`No se encontró URL para documento ${doc}`);
          }
        } catch (error) {
          console.error(`Error al consultar documento ${doc}:`, error);
        }
      }

      // Consultar documento de garantía
      try {
        const res = await axios.get(
          `${environment.DOCUMENTS_SERVICE_URL}/guarantee/${this.solicitud.id}/${this.solicitud.requester_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const url = res.data?.data?.url || null;
        if (url) {
          this.solicitud.url_guarantee = url;
          console.log('Documento guarantee cargado:', url);
        } else {
          console.warn('No se encontró URL para documento guarantee');
        }
      } catch (error) {
        console.error('Error al consultar documento guarantee:', error);
      }

      // Evaluar límite de relación de esfuerzo
      const tieneGarantia = this.solicitud.guarantee_type != 3;
      const valorGarantia = this.solicitud.guarantee_value || 0;
      const montoSolicitado = this.solicitud.amount;
      let limite: number;

      if (!tieneGarantia) {
        limite = tipo === 'hipotecario' ? 28 : 35;
      } else {
        if (tipo === 'hipotecario') {
          limite = valorGarantia >= montoSolicitado ? 40 : 28;
        } else if (tipo === 'personal') {
          limite = 40;
        } else if (tipo === 'prendario') {
          limite = 45;
        } else {
          limite = 35;
        }
      }

      this.esfuerzoAlto = this.esfuerzo > limite;
      console.log('¿Relación de esfuerzo alta?:', this.esfuerzoAlto);
    }
  }

  async obtenerCreditosPorRfc(): Promise<void> {
    if (!this.solicitud?.rfc) return;
    

    const rawToken = localStorage.getItem('accessToken');
    let token = '';

    if (rawToken) {
      try {
        const parsed = JSON.parse(rawToken);
        token = parsed._value || '';
      } catch (e) {
        token = rawToken;
      }
    }

    try {
      const response = await axios.get(
        `${environment.REQUESTS_SERVICE_URL}/credits/rfc/${this.solicitud.rfc}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      this.creditsByRfc = response.data?.data || [];
      console.log('Créditos por RFC:', this.creditsByRfc);
    } catch (error) {
      console.error('Error al obtener créditos por RFC:', error);
      this.creditsByRfc = [];
    }
  }

  getValorCatalogo<T extends Record<string, number>>(
    catalogo: T,
    clave: any,
    fallback: number
  ): number {
    const key = (clave?.toLowerCase() ?? '') as keyof T;
    return catalogo[key] ?? fallback;
  }

  getShapOriginPercent(): number {
    return Math.min(Math.max(this.shapBase, 0), 1) * 100;
  }

  getShapFeatureLabel(feature: string): string {
    const labels: Record<string, string> = {
      FLAG_OWN_CAR: 'Auto propio',
      FLAG_OWN_REALTY: 'Vivienda propia',
      CNT_CHILDREN: 'Número de hijos',
      AMT_INCOME_TOTAL: 'Ingreso disponible',
      NAME_INCOME_TYPE: 'Tipo de ingreso',
      NAME_EDUCATION_TYPE: 'Nivel educativo',
      NAME_FAMILY_STATUS: 'Estado civil',
      NAME_HOUSING_TYPE: 'Tipo de vivienda',
      DAYS_BIRTH: 'Edad (días)',
      DAYS_EMPLOYED: 'Días trabajando',
      OCCUPATION_TYPE: 'Tipo de ocupación',
      CNT_FAM_MEMBERS: 'Integrantes de la familia',
      CNT_ADULTS: 'Número de adultos',
      AMT_INCOME_PER_CHILDREN: 'Ingreso por hijo',
      AMT_INCOME_PER_FAM_MEMBER: 'Ingreso por integrante',
    };

    return labels[feature] ?? feature.replaceAll('_', ' ').toLowerCase();
  }

  getShapScale(): number {
    const origin = this.getShapOriginPercent();
    const maxRight = 100 - origin;
    const maxLeft = origin;

    const positives = this.shapValues
      .filter(item => item.value > 0)
      .map(item => item.value);
    const negatives = this.shapValues
      .filter(item => item.value < 0)
      .map(item => Math.abs(item.value));

    const maxPos = positives.length ? Math.max(...positives) : 0;
    const maxNeg = negatives.length ? Math.max(...negatives) : 0;

    const scaleRight = maxPos > 0 ? maxPos / maxRight : 0;
    const scaleLeft = maxNeg > 0 ? maxNeg / maxLeft : 0;

    return Math.max(scaleRight, scaleLeft, 0.000001);
  }

  getShapWidth(value: number): number {
    const scale = this.getShapScale();
    const origin = this.getShapOriginPercent();
    const width = Math.abs(value) / scale;
    return value >= 0 ? Math.min(width, 100 - origin) : Math.min(width, origin);
  }

  getShapBarLeft(value: number): number {
    const origin = this.getShapOriginPercent();
    return value >= 0 ? origin : origin - this.getShapWidth(value);
  }

  getShapPositiveTotal(): number {
    return this.shapValues.reduce(
      (sum, item) => sum + Math.max(0, Number(item.value || 0)),
      0
    );
  }

  getShapNegativeTotal(): number {
    return this.shapValues.reduce(
      (sum, item) => sum + Math.max(0, -Number(item.value || 0)),
      0
    );
  }

  getShapTotalValue(): number {
    return this.shapValues.reduce((sum, item) => sum + Number(item.value || 0), 0);
  }

  getShapTotalNegativeValue(): number {
    return this.shapValues.reduce((sum, item) => {
      const val = Number(item.value || 0);
      return val < 0 ? sum + val : sum;
    }, 0);
  }

  getShapTotalPositiveValue(): number {
    return this.shapValues.reduce((sum, item) => {
      const val = Number(item.value || 0);
      return val > 0 ? sum + val : sum;
    }, 0);
  }

  getShapSummaryBasePercent(): number {
    return Math.min(Math.max(this.shapBase, 0), 1) * 100;
  }

  getNormalizedIaResultado(): number {
    const result = Number(this.iaResultado ?? this.shapBase);
    return result > 1 ? result / 100 : result;
  }

  getShapDisplayScore(): number {
    return this.getNormalizedIaResultado();
  }

  getShapSummaryFinalPercent(): number {
    const finalValue = this.getNormalizedIaResultado();
    return Math.min(Math.max(finalValue, 0), 1) * 100;
  }

  getShapSummaryCalculatedFinal(): number {
    const totalPositive = this.getShapTotalPositiveValue();
    const totalNegative = this.getShapTotalNegativeValue();
    return this.shapBase + totalPositive + totalNegative;
  }

  getShapSummaryNegativeLeft(): number {
    const calculatedFinal = this.getShapSummaryCalculatedFinal();
    return Math.min(Math.max(calculatedFinal, 0), 1) * 100;
  }

  getShapSummaryNegativeWidth(): number {
    const totalNegative = this.getShapTotalNegativeValue();
    const absNegative = Math.abs(totalNegative);
    return Math.min(Math.max(absNegative, 0), 1) * 100;
  }

  getShapSummaryPositiveLeft(): number {
    const totalPositive = this.getShapTotalPositiveValue();
    const calculatedFinal = this.getShapSummaryCalculatedFinal();
    const left = calculatedFinal - totalPositive;
    return Math.min(Math.max(left, 0), 1) * 100;
  }

  getShapSummaryPositiveWidth(): number {
    const totalPositive = this.getShapTotalPositiveValue();
    return Math.min(Math.max(totalPositive, 0), 1) * 100;
  }

  getShapFinalValue(): number {
    return +Number(this.iaResultado ?? this.shapBase).toFixed(4);
  }

  async aprobarSolicitud(): Promise<void> {
    const rawToken = localStorage.getItem('accessToken');
    let token = '';

    if (rawToken) {
      try {
        const parsed = JSON.parse(rawToken);
        token = parsed._value || '';
      } catch (e) {
        token = rawToken;
      }
    }

    const id = this.solicitud.id;
    const url = `${environment.REQUESTS_SERVICE_URL}/${id}`;

    try {
      const response = await axios.patch(
        url,
        { status: 3 },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      this.message.success('Solicitud aprobada');
    } catch (error) {
      console.error('Error al aprobar solicitud:', error);
    }
  }

  async rechazarSolicitud(): Promise<boolean> {
    const rawToken = localStorage.getItem('accessToken');
    let token = '';

    if (rawToken) {
      try {
        const parsed = JSON.parse(rawToken);
        token = parsed._value || '';
      } catch (e) {
        token = rawToken;
      }
    }

    const id = this.solicitud.id;
    const url = `${environment.REQUESTS_SERVICE_URL}/${id}`;

    try {
      const response = await axios.patch(
        url,
        { status: 4 },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      this.message.warning('Solicitud rechazada');
      return true;
    } catch (error) {
      console.error('Error al rechazar solicitud:', error);
      this.message.error('No se pudo rechazar la solicitud');
      return false;
    }
  }
  openInNewTab(url: string): void {
    window.open(url, '_blank');
  }

  getScale(): number {
    const range = this.shapMax - this.shapMin;
    return range === 0 ? 1 : range;
  }

  getPercent(value: number): number {
    const total = this.shapMax - this.shapMin;
    return total === 0 ? 0 : ((value - this.shapMin) / total) * 100;
  }

  async procesarIA(): Promise<void> {
    if (!this.solicitud) return;
    this.iaResultado = null;
    this.iaMensaje = '';
    this.relationEffortRejected = false;
    const requiredDocs = ['domicile', 'birth', 'ine'];
    const docLabels: Record<string, string> = {
      domicile: 'Comprobante de domicilio',
      birth: 'Acta de nacimiento',
      ine: 'INE',
      income: 'Comprobante de ingresos',
      guarantee: 'Comprobante de garantía'
    };

    for (const doc of requiredDocs) {
      const url = this.solicitud?.[`url_${doc}`];
      if (url && !this.documentChecks[doc]) {
        const label = docLabels[doc] || doc;
        this.message.error(`Revise y marque el documento: ${label}`);
        return;
      }
    }

    this.iaLoading = true;
    try {

    const rawToken = localStorage.getItem('accessToken');
    let token = '';

    if (rawToken) {
      try {
        const parsed = JSON.parse(rawToken);
        token = parsed._value || '';
      } catch (e) {
        token = rawToken;
      }
    }

    const children = Number(this.solicitud.count_children || 0);
    const familyMembers = Number(
      this.solicitud.count_family_members ??
        Number(this.solicitud.count_adults || 0) + children
    );
    const adults = Number(
      this.solicitud.count_adults ?? Math.max(familyMembers - children, 0)
    );
    const availableIncome = Number(this.ingresoDisponible || 0);
    const occupationType = Number(this.solicitud.occupation_type);
    const educationLevel = String(this.solicitud.education_level || '').toLowerCase();
    const civilStatus = String(this.solicitud.civil_status || '').toLowerCase();
    const rentExpenses = Number(this.solicitud.rent_expenses || 0);

    const birthdateValue = String(this.solicitud.birthdate || '');
    const isoBirthdate = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthdateValue);
    const localBirthdate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(birthdateValue);
    const birthdate = isoBirthdate
      ? new Date(Number(isoBirthdate[1]), Number(isoBirthdate[2]) - 1, Number(isoBirthdate[3]))
      : localBirthdate
        ? new Date(Number(localBirthdate[3]), Number(localBirthdate[2]) - 1, Number(localBirthdate[1]))
        : new Date(birthdateValue);

    if (Number.isNaN(birthdate.getTime())) {
      this.message.error('No se pudo calcular la edad: fecha de nacimiento inválida.');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    birthdate.setHours(0, 0, 0, 0);
    const daysSinceBirth = Math.floor(
      (today.getTime() - birthdate.getTime()) / (24 * 60 * 60 * 1000)
    );

    const output = {
      relation: this.esfuerzoAlto,
      FLAG_OWN_CAR: [this.solicitud.has_own_car ? 1 : 0],
      FLAG_OWN_REALTY: [this.solicitud.has_own_realty ? 1 : 0],
      CNT_CHILDREN: [children],
      AMT_INCOME_TOTAL: [availableIncome],
      NAME_INCOME_TYPE: [occupationType],
      NAME_EDUCATION_TYPE: [
        educationLevel === 'licenciatura' || educationLevel === 'maestria' || educationLevel === 'maestría'
          ? 0
          : educationLevel === 'preparatoria'
            ? 1
            : educationLevel === 'secundaria'
              ? 2
              : 3,
      ],
      NAME_FAMILY_STATUS: [
        civilStatus === 'divorciado'
          ? 1
          : civilStatus === 'soltero' || civilStatus === 'casado'
            ? 0
            : 3,
      ],
      NAME_HOUSING_TYPE: [
        this.solicitud.has_own_realty ? 0 : rentExpenses > 0 ? 1 : 3,
      ],
      DAYS_BIRTH: [daysSinceBirth],
      DAYS_EMPLOYED: [Number(this.solicitud.days_employed || 0)],
      OCCUPATION_TYPE: [occupationType],
      CNT_FAM_MEMBERS: [familyMembers],
      CNT_ADULTS: [adults],
      AMT_INCOME_PER_CHILDREN: [
        children > 0 ? +(availableIncome / children).toFixed(2) : 0,
      ],
      AMT_INCOME_PER_FAM_MEMBER: [
        familyMembers > 0 ? +(availableIncome / familyMembers).toFixed(2) : 0,
      ],
    };

    /* Payload de prueba anterior:
    const output = {
      relation: this.esfuerzoAlto,
      FLAG_OWN_CAR: [0.0],
      FLAG_OWN_REALTY: [0.0],
      CNT_CHILDREN: [0.0],
      AMT_INCOME_TOTAL: [427500.0],
      NAME_INCOME_TYPE: [0.0],
      NAME_EDUCATION_TYPE: [0.0],
      NAME_FAMILY_STATUS: [0.0],
      NAME_HOUSING_TYPE: [0.0],
      DAYS_BIRTH: [12005.0],
      DAYS_EMPLOYED: [4542.0],
      OCCUPATION_TYPE: [0.0],
      CNT_FAM_MEMBERS: [2.0],
      CNT_ADULTS: [2.0],
      AMT_INCOME_PER_CHILDREN: [0.0],
      AMT_INCOME_PER_FAM_MEMBER: [213750.0]
    };
    */

    console.log('Datos para IA:', output);
    let resultadoIA: number = 50;
    try {
      const response = await axios.post(
        `${environment.REQUESTS_SERVICE_URL}/evaluate/${this.solicitud?.id}`,
        output,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log(response.data)
      const backendMessage = String(response.data?.message || '')
        .trim()
        .toLowerCase();
      if (backendMessage === 'relation effort to big to be analyzed by ai') {
        this.iaColor = '#cc0000';
        this.relationEffortRejected = await this.rechazarSolicitud();
        this.iaMensaje = this.relationEffortRejected
          ? 'Solicitud rechazada por relación de esfuerzo alta'
          : 'No se pudo rechazar la solicitud por relación de esfuerzo alta';
        return;
      }

      const rawScore = response.data?.data?.score;
      const score = Number(rawScore);
      if (rawScore == null || !Number.isFinite(score)) {
        this.message.error('La respuesta de IA no contiene un resultado válido');
        return;
      }

      resultadoIA = score;
      this.shapValues = response.data?.data?.shap || [];
      const values = this.shapValues.map(v => v.value);

      this.shapMin = Math.min(...values);
      this.shapMax = Math.max(...values);
      let current = this.shapBase;


      let acc = 0;

      this.shapAccumulated = this.shapValues.map(item => {
        const start = acc;
        const end = acc + item.value;
        acc = end;

        return {
          ...item,
          start,
          end
        };
      });
    } catch (error) {
      console.error('Error al obtener solicitud por ID:', error);
    }

    console.log('Resultado de la IA', resultadoIA);
    const id = this.solicitud.id;
    const url = `${environment.REQUESTS_SERVICE_URL}/${id}`;
    try {
      const response = await axios.patch(
        url,
        {
          score: resultadoIA,
          monthly_income_at_evaluation: Number(this.solicitud.monthly_income),
          count_children_at_evaluation: this.solicitud.count_children,
          count_adults_at_evaluation: this.solicitud.count_adults,
          count_family_members_at_evaluation: this.solicitud.count_family_members,
          civil_status_at_evaluation: this.solicitud.civil_status,
          education_level_at_evaluation: this.solicitud.education_level,
          occupation_type_at_evaluation: this.solicitud.occupation_type,
          days_employed_at_evaluation: this.solicitud.days_employed,
          has_own_car_at_evaluation: this.solicitud.has_own_car,
          has_own_realty_at_evaluation: this.solicitud.has_own_realty,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      this.message.success('Solicitud evaluada correctamente');
    } catch (error) {
      console.error('Error al rechazar solicitud:', error);
    }
    this.iaResultado = resultadoIA;

    if (resultadoIA < 40) {
      this.iaMensaje = 'Solicitud Rechazada por IA';
      this.iaColor = '#cc0000';
      this.rechazarSolicitud();
    } else if (resultadoIA < 61) {
      this.iaMensaje =
        'Solicitud a revisión manual, por favor tome las medidas necesarias...';
      this.iaColor = '#b97800';
    } else {
      this.iaMensaje = 'Solicitud Aprobada por IA';
      this.iaColor = '#2a8f2a';
    }
    } catch (error) {
      console.error('Error procesando IA:', error);
    } finally {
      this.iaLoading = false;
    }
  }
}
