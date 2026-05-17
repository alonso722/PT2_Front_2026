import { Component, OnInit } from '@angular/core';
import { NavBarComponent } from '../misc/navBar/nav-bar/nav-bar.component';
import { CommonModule } from '@angular/common';
import { SolicitudService } from '../services/solicitud.service';
import { NzMessageModule, NzMessageService } from 'ng-zorro-antd/message';
import axios from 'axios';
import { FormsModule } from '@angular/forms';

import { environment } from '../../environments/environment';

@Component({
  selector: 'app-details-page',
  standalone: true,
  imports: [CommonModule, NavBarComponent, FormsModule],
  templateUrl: './details-page.component.html',
  styleUrl: './details-page.component.css',
})
export class DetailsPageComponent implements OnInit {
  solicitud: any = null;
  esfuerzo: number = 0;
  esfuerzoAlto: boolean = false;

  totalGastos: number = 0;
  ingresoDisponible: number = 0;
  mensualidad: number = 0;

  iaResultado: number | null = null;
  iaMensaje: string = '';
  iaColor: string = '';

  gastos = {
    food_expenses: 1500,
    education_expenses: 1000,
    transport_expenses: 800,
    utilities_expenses: 1200,
    health_expenses: 600,
    maintenance_expenses: 500,
    rent_expenses: 2500,
  };

  documentChecks: Record<string, boolean> = {
    domicile: false,
    birth: false,
    ine: false,
    guarantee: false
  };

  constructor(
    private solicitudService: SolicitudService,
    private message: NzMessageService
  ) {}

  async ngOnInit(): Promise<void> {
    this.solicitud = this.solicitudService.getSolicitud();
    console.log('Solicitud recibida en details-page:', this.solicitud);

    if (this.solicitud) {
      const ingresoMensual = this.solicitud.monthly_income;

      // <-- Aquí cambiamos const por this.
      this.totalGastos = Object.values(this.gastos).reduce(
        (acc, g) => acc + g,
        0
      );
      this.ingresoDisponible = ingresoMensual - this.totalGastos;

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

      const docEndpoints = ['ine', 'birth', 'domicile'];
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

  getValorCatalogo<T extends Record<string, number>>(
    catalogo: T,
    clave: any,
    fallback: number
  ): number {
    const key = (clave?.toLowerCase() ?? '') as keyof T;
    return catalogo[key] ?? fallback;
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

  async rechazarSolicitud(): Promise<void> {
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
      this.message.success('Solicitud rechazada');
    } catch (error) {
      console.error('Error al rechazar solicitud:', error);
    }
  }
  openInNewTab(url: string): void {
    window.open(url, '_blank');
  }

  async procesarIA(): Promise<void> {
    if (!this.solicitud) return;
    const requiredDocs = ['domicile', 'birth', 'ine'];
      for (const doc of requiredDocs) {
        const url = this.solicitud?.[`url_${doc}`];
        if (url && !this.documentChecks[doc]) {
          this.message.error(`Falta marcar el documento: ${doc.toUpperCase()}`);
          return;
        }
      }

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

    const catalogos = {
      housingType: {
        propia: 0,
        rentada: 1,
        hipotecada: 2,
        otro: 3,
      },
      education: {
        Licenciatura: 0,
        Maestría: 0,
        Preparatoria: 1,
        Otro: 2,
      },
      ocupation: {
        manager: 0,
        junior: 1,
        senior: 2,
        Otro: 3,
      },
      family: {
        Soltero: 0,
        Casado: 0,
        Divorciado: 1,
        Otro: 3,
      },
    };

    const ownRealty = this.solicitud.has_own_realty ? 1 : 0;
    const ownCar = this.solicitud.has_own_car ? 1 : 0;
    const houseType = this.solicitud.has_domicile ? 1 : 0;
    const amountType = this.solicitud.days_employed > 0 ? 1 : 0;

    const CNT_CHILDREN = Number(this.solicitud.count_children);
    const AMT_INCOME_TOTAL = Number(this.solicitud.monthly_income * 12);
    const CNT_ADULTS =
      this.solicitud.count_family_members - this.solicitud.count_children;

    const AMT_INCOME_PER_CHILDREN =
      CNT_CHILDREN > 0 ? +(AMT_INCOME_TOTAL / CNT_CHILDREN).toFixed(2) : 0;
    const AMT_INCOME_PER_FAM_MEMBER = +(
      AMT_INCOME_TOTAL / this.solicitud.count_family_members
    ).toFixed(2);

    const output = {
      relation: this.esfuerzoAlto,
      FLAG_OWN_CAR: [ownCar],
      FLAG_OWN_REALTY: [ownRealty],
      CNT_CHILDREN: [CNT_CHILDREN],
      AMT_INCOME_TOTAL: [AMT_INCOME_TOTAL],
      NAME_INCOME_TYPE: [amountType],
      NAME_EDUCATION_TYPE: [
        this.getValorCatalogo(catalogos.education, this.solicitud.education, 3),
      ],
      NAME_FAMILY_STATUS: [
        this.getValorCatalogo(catalogos.family, this.solicitud.civil_status, 1),
      ],
      NAME_HOUSING_TYPE: [houseType],
      DAYS_BIRTH: [12005],
      DAYS_EMPLOYED: [4542],
      OCCUPATION_TYPE: [
        this.getValorCatalogo(catalogos.ocupation, this.solicitud.ocupation, 3),
      ],
      CNT_FAM_MEMBERS: [this.solicitud.count_family_members],
      CNT_ADULTS: [CNT_ADULTS],
      AMT_INCOME_PER_CHILDREN: [AMT_INCOME_PER_CHILDREN],
      AMT_INCOME_PER_FAM_MEMBER: [AMT_INCOME_PER_FAM_MEMBER],
    };

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
      resultadoIA = response.data?.data?.score;
    } catch (error) {
      console.error('Error al obtener solicitud por ID:', error);
    }

    console.log('Resultado de la IA', resultadoIA);
    const id = this.solicitud.id;
    const url = `${environment.REQUESTS_SERVICE_URL}/${id}`;
    try {
      const response = await axios.patch(
        url,
        { score: resultadoIA },
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
  }
}
