import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { NzModalService, NzModalRef } from 'ng-zorro-antd/modal';
import { DetailsComponent } from '../../../layout/dasboard/details/details.component';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NgChartsModule } from 'ng2-charts';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { ChartData, ChartOptions } from 'chart.js';
import { FormsModule } from '@angular/forms';
import axios from 'axios';
import { environment } from '../../../../environments/environment';

type Estado = 'Enviada' | 'En revisión' | 'Aprobada' | 'Rechazada';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [
    NzCardModule,
    DetailsComponent,
    CommonModule,
    NzModalModule,
    ProgressBarComponent,
    NgChartsModule,
    NzDescriptionsModule,
    FormsModule
  ],
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.css'],
})
export class CardComponent implements OnInit {
  solicitudes: any[] = [];

  pieLabels: Estado[] = ['Enviada', 'En revisión', 'Aprobada', 'Rechazada'];

  pieData: ChartData<'pie', number[], Estado> = {
    labels: this.pieLabels,
    datasets: [{ data: [] }],
  };

  barData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Solicitudes' }],
  };

  // Tipos (puedes usarlos si quieres mostrar el tipo dinámicamente)
  pieType: 'pie' = 'pie';
  barType: 'bar' = 'bar';

  // ---------- OPTIONS robustas (Chart.js v4 compatible) ----------
  pieOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          // color para canvas-legend y para los casos HTML (Chart.js v4)
          color: '#ffffff',
          usePointStyle: true,
          boxWidth: 12,
          boxHeight: 12,
          padding: 12,
          // font: { size: 13 } // si quieres ajustar tamaño
        }
      },
      tooltip: {
        // colores del tooltip
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        backgroundColor: '#2b2b2b',
        borderColor: '#444',
        borderWidth: 1
      }
    }
  };

  barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: '#ffffff',
          usePointStyle: true,
          boxWidth: 12,
          boxHeight: 12,
          padding: 12
        }
      },
      tooltip: {
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        backgroundColor: '#2b2b2b',
        borderColor: '#444',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        // ticks de eje X
        ticks: {
          color: '#ffffff'
        },
        grid: {
          color: 'rgba(255,255,255,0.03)'
        }
      },
      y: {
        ticks: {
          color: '#ffffff'
        },
        grid: {
          color: 'rgba(255,255,255,0.03)'
        }
      }
    }
  };

  modalRef?: NzModalRef;
  isBrowser = false;
  userType: string = '';

  selectedStatus: string = '';
  selectedCredit: string = '';

  tiposCredito: string[] = ['Personal', 'Hipotecario', 'Prendario'];

  solicitudesOriginal: any[] = [];

  constructor(
    private modal: NzModalService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.fetchSolicitudes();
    }
  }

  async fetchSolicitudes(): Promise<void> {
    try {
      const rawToken = localStorage.getItem('accessToken');
      const type = localStorage.getItem('typeUser');
      let token = '';

      if (rawToken) {
        try {
          const parsed = JSON.parse(rawToken);
          token = parsed._value || '';
        } catch (e) {
          token = rawToken;
        }
      }

      if (type) {
        try {
          const parsed = JSON.parse(type);
          this.userType = parsed._value || '';
        } catch (e) {}
      }

      let endpoint = `${environment.REQUESTS_SERVICE_URL}/requester`;
      if (this.userType === 'supervisor') {
        endpoint = `${environment.REQUESTS_SERVICE_URL}/all`;
      } else if (this.userType === 'analyst') {
        endpoint = `${environment.REQUESTS_SERVICE_URL}/analyst`;
      }

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const solicitudesCrudas = response.data.data;

      this.solicitudesOriginal = this.solicitudes = solicitudesCrudas.map((s: any) => ({
        ...s,
        statusInt: s.status,
        status: this.convertirEstado(s.status),
        creditType: this.convertirTipoCredito(s.credit_type),
      }));

      this.generarDatosGraficas();
    } catch (error) {
      console.error('Error al obtener solicitudes:', error);
    }
  }

  convertirEstado(valor: any): Estado {
    if (valor === 4 || valor === null) return 'Rechazada';
    if (valor === 1 || valor === false) return 'Enviada';
    if (valor === 2) return 'En revisión';
    if (valor === 3 || valor === true) return 'Aprobada';
    return 'Enviada';
  }

  aplicarFiltros(): void {
    this.solicitudes = this.solicitudesOriginal.filter((sol) => {
      const coincideStatus = this.selectedStatus === '' || sol.status === this.selectedStatus;
      const coincideCredito = this.selectedCredit === '' || sol.creditType === this.selectedCredit;
      return coincideStatus && coincideCredito;
    });

    this.generarDatosGraficas();
  }

  convertirTipoCredito(id: number): string {
    switch (id) {
      case 1:
        return 'Personal';
      case 2:
        return 'Hipotecario';
      case 3:
        return 'Prendario';
      default:
        return 'Desconocido';
    }
  }

  generarDatosGraficas(): void {
    const estados: Record<Estado, number> = {
      Enviada: 0,
      'En revisión': 0,
      Aprobada: 0,
      Rechazada: 0,
    };
    const creditos: { [tipo: string]: number } = {};

    this.solicitudes.forEach((s) => {
      const status = s.status as Estado;
      if (this.pieLabels.includes(status)) {
        estados[status]++;
      }
      if (s.creditType) {
        creditos[s.creditType] = (creditos[s.creditType] || 0) + 1;
      }
    });

    this.pieData = {
      labels: this.pieLabels,
      datasets: [
        {
          data: Object.values(estados),
          backgroundColor: ['#6DE3F2', '#f0da69', '#81cd87', '#ee6c64'],
          borderColor: '#fff',
          borderWidth: 1,
        },
      ],
    };

    this.barData = {
      labels: Object.keys(creditos),
      datasets: [
        {
          data: Object.values(creditos),
          label: 'Solicitudes',
          backgroundColor: ['#6DE3F2', '#98dde2', '#60b9be'],
        },
      ],
    };
  }

  showDetails(solicitud: any): void {
    this.modalRef = this.modal.create({
      nzTitle: 'Detalles de la solicitud',
      nzContent: DetailsComponent,
      nzFooter: null,
      nzWrapClassName: 'custom-modal',
      nzClassName: 'custom-modal-body',
    });
    this.modalRef.componentInstance!.solicitud = solicitud;
    this.modalRef.componentInstance!.modalRef = this.modalRef;
  }

  destroyModal(): void {
    this.modalRef?.destroy();
  }

  calculateProgress(status: string): number {
    switch (status) {
      case 'Enviada':
        return 33;
      case 'En revisión':
        return 66;
      case 'Aprobada':
      case 'Rechazada':
        return 100;
      default:
        return 0;
    }
  }
}
