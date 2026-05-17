import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalStorageService } from 'angular-web-storage';
import { ChatComponent } from '../../../misc/cards/chat/chat.component';
import { DetailsPageComponent } from '../../../details-page/details-page.component';
import { Router } from '@angular/router';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { SolicitudService } from '../../../services/solicitud.service';
import axios from 'axios';
import { environment } from '../../../../environments/environment';
import { NzMessageModule, NzMessageService } from 'ng-zorro-antd/message';

@Component({
  selector: 'app-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChatComponent,
    DetailsPageComponent,
    NzMessageModule,
    NzSpinModule,
  ],
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.css'],
})
export class DetailsComponent implements OnInit {
  @Input() modalRef?: NzModalRef;
  @Input() solicitud: any;
  @Output() closeDrawer: EventEmitter<boolean> = new EventEmitter<boolean>();

  isAdmin: boolean = false;
  isAnalyst: boolean = false;
  isSupervisor: boolean = false;
  isFinished: boolean = false;

  selectedAnalyst: string = '';
  analysts: { sub: string; name: string; type: string }[] = [];
  selectedAnalystId: string = '';

  userTypeFromStorage: 'requester' | 'analyst' | 'supervisor' = 'requester';

  uploadMode: boolean = false; // controla el switch documentos
  documentChecks: { [key: string]: boolean } = {};
  documentFiles: { [key: string]: File | null } = {
    ine: null,
    birth: null,
    address: null,
    guaranteeDoc: null,
    //income: null,
  };

  documentUrls: { [key: string]: string | null } = {
    ine: null,
    birth: null,
    address: null,
    guaranteeDoc: null,
    //income: null,
  };

  constructor(
    private localStorage: LocalStorageService,
    private router: Router,
    private solicitudService: SolicitudService,
    private message: NzMessageService
  ) {}

  userName: string = this.localStorage.get('userName') || 'Usuario Anonimo';

  loading: boolean = true;

  async ngOnInit(): Promise<void> {
    this.loading = true;

    try {
      this.userTypeFromStorage = this.getUserTypeFromStorage();
      this.checkUserType();

      const id = this.solicitud?.id;
      if (id) {
        await this.fetchSolicitudById(id);
        if (this.isSupervisor) {
          await this.fetchAnalistas();
          this.selectedAnalystId =
            this.solicitud?.supervisor_id || this.solicitud?.analyst_id || '';
        }
      }
    } finally {
      this.loading = false;
    }
  }

    openInNewTab(url: string): void {
    window.open(url, '_blank');
  }

    async handleFileChange(event: Event, type: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      const maxSizeInBytes = 1.5 * 1024 * 1024;

      if (file.type !== 'application/pdf') {
        this.message.error('Solo se permiten archivos en formato PDF.');
        return;
      }

      if (file.size > maxSizeInBytes) {
        this.message.error('El archivo excede el tamaño máximo de 1.5 MB.');
        return;
      }

      this.documentFiles[type] = file;

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

      let uploadUrl = '';
      let getUrl = '';

      // if (type === 'guaranteeDoc') {
      //   uploadUrl = `${environment.DOCUMENTS_SERVICE_URL}/${this.lastRequestId}/guarantee`;
      //   getUrl = `${environment.DOCUMENTS_SERVICE_URL}/guarantee/file/${this.lastRequestId}`;
      // } else {
        const endpoints: Record<string, string> = {
          ine: `${environment.DOCUMENTS_SERVICE_URL}/ine`,
          birth: `${environment.DOCUMENTS_SERVICE_URL}/birth`,
          address: `${environment.DOCUMENTS_SERVICE_URL}/domicile`,
          //income: `${environment.DOCUMENTS_SERVICE_URL}/income`,
        };
        uploadUrl = endpoints[type];
        getUrl = endpoints[type];
      //}

      try {
        const formData = new FormData();
        formData.append('file', file);

        await axios.post(uploadUrl, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        this.message.success(`Documento ${type} subido correctamente`);

        const response = await axios.get(getUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const url = response.data?.data?.url || null;
        if (url) {
          this.documentUrls[type] = url;
          console.log(`URL del documento ${type}:`, url);
        } else {
          this.message.warning(`No se obtuvo URL para el documento ${type}`);
        }
      } catch (error) {
        console.error(
          `Error al subir u obtener URL del documento ${type}:`,
          error
        );
        this.message.error(`Error al subir documento ${type}`);
      }
    }
  }

  async fetchSolicitudById(id: string): Promise<void> {
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
        `${environment.REQUESTS_SERVICE_URL}/id/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response.data?.data || {};
      console.log(data);

      let creditStatus = 'Desconocido';
      switch (data.status) {
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

      let creditTypeText = 'Desconocido';
      switch (data.credit_type) {
        case 1:
          creditTypeText = 'Personal';
          break;
        case 2:
          creditTypeText = 'Hipotecario';
          break;
        case 3:
          creditTypeText = 'Prendario';
          break;
      }

      this.solicitud = {
        ...data,
        creditType: creditTypeText,
        creditStatus: creditStatus,
        chat: Array.isArray(data.chat) ? [...data.chat] : [],
      };
      console.log('Solicitud', this.solicitud);

      // 🔹 Aquí obtenemos los documentos asociados
      const docEndpoints = ['ine', 'birth', 'domicile'];
      for (const doc of docEndpoints) {
        try {
          const res = await axios.get(
            `${environment.DOCUMENTS_SERVICE_URL}/${doc}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          this.solicitud[`url_${doc}`] = res.data?.data?.url || null;
        } catch (error) {
          console.warn(`No se pudo obtener documento ${doc}`, error);
        }
      }

      // 🔹 Documento de garantía
      // try {
      //   const res = await axios.get(
      //     `${environment.DOCUMENTS_SERVICE_URL}/guarantee/${data.id}/${data.requester_id}`,
      //     {
      //       headers: { Authorization: `Bearer ${token}` },
      //     }
      //   );
      //   this.solicitud.url_guarantee = res.data?.data?.url || null;
      // } catch (error) {
      //   console.warn('No se pudo obtener documento guarantee', error);
      // }

    } catch (error) {
      console.error('Error al obtener solicitud por ID:', error);
    }
  }

  onMessageSent(): void {
    const id = this.solicitud?.id;
    if (id) {
      this.fetchSolicitudById(id);
    }
  }

  getUserTypeFromStorage(): 'requester' | 'analyst' | 'supervisor' {
    const rawType = localStorage.getItem('typeUser');
    if (!rawType) return 'requester';

    try {
      const parsed = JSON.parse(rawType);
      const userType = parsed._value || parsed || 'requester';
      if (
        userType === 'analyst' ||
        userType === 'supervisor' ||
        userType === 'requester'
      ) {
        return userType;
      } else {
        return 'requester';
      }
    } catch {
      if (
        rawType === 'analyst' ||
        rawType === 'supervisor' ||
        rawType === 'requester'
      ) {
        return rawType;
      }
      return 'requester';
    }
  }

  async fetchAnalistas(): Promise<void> {
    try {
      const rawToken = localStorage.getItem('accessToken');
      let token = '';
      let decoded: any = null;

      if (rawToken) {
        try {
          const parsed = JSON.parse(rawToken);
          token = parsed._value || '';
        } catch (e) {
          token = rawToken;
        }
        const payload = token.split('.')[1];
        decoded = JSON.parse(atob(payload));
      }

      const response = await axios.get(
        `${environment.STAFF_SERVICE_URL}/analyst/all`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = response.data.data || [];
      this.analysts = data.map((analyst: any) => ({
        sub: analyst.sub || '',
        name: analyst.name || analyst.full_name || 'Analista',
        type: 'analyst',
      }));
      if (decoded?.sub && decoded['name']) {
        const yaExiste = this.analysts.some((a) => a.sub === decoded.sub);
        if (!yaExiste) {
          this.analysts.unshift({
            sub: decoded.sub,
            name: decoded['name'],
            type: 'supervisor',
          });
        }
      }
    } catch (error) {
      console.error('Error al obtener analistas:', error);
    }
  }

  async assignAnalyst(): Promise<void> {
    const seleccionado = this.analysts.find(
      (a) => a.sub === this.selectedAnalystId
    );
    if (!seleccionado) {
      console.warn('Analista no encontrado');
      return;
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

    const id = this.solicitud?.id;
    const url = `${environment.REQUESTS_SERVICE_URL}/${id}`;

    const body =
      seleccionado.type === 'supervisor'
        ? { supervisor_id: seleccionado.sub, status: 2 }
        : { analyst_id: seleccionado.sub };

    try {
      const response = await axios.patch(url, body, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log('Asignación exitosa:', response.data);
    } catch (error) {
      console.error('Error al asignar analista/supervisor:', error);
    }
  }

  async requestFinished(): Promise<void> {
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

    const id = this.solicitud?.id;
    const url = `${environment.REQUESTS_SERVICE_URL}/${id}`;

    const body = { is_fiinished: this.isFinished ? 1 : 0 };

    try {
      const response = await axios.patch(url, body, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log('Asignación exitosa:', response.data);
    } catch (error) {
      console.error('Error al asignar analista/supervisor:', error);
    }
  }

  checkUserType(): void {
    const userType = this.localStorage.get('typeUser');
    this.isAnalyst = userType === 'analyst';
    this.isSupervisor = userType === 'supervisor';
    this.isAdmin = userType === 'admin';
  }

  details(): void {
    this.solicitudService.setSolicitud(this.solicitud);
    this.closeDrawer.emit(true);
    this.modalRef?.destroy();
    this.router.navigate(['/details']);
  }
}
