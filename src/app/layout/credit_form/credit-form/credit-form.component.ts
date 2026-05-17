import { Component,  ViewEncapsulation  } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NavBarComponent } from '../../../misc/navBar/nav-bar/nav-bar.component';
import { environment } from '../../../../environments/environment';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageModule, NzMessageService } from 'ng-zorro-antd/message';
import axios from 'axios';

@Component({
  selector: 'app-credit-form',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './credit-form.component.html',
  styleUrls: ['./credit-form.component.css'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzButtonModule,
    NzUploadModule,
    NzModalModule,
    NzMessageModule,
    NavBarComponent,
    NzInputNumberModule
  ],
  
})
export class CreditFormComponent {
  validateForm: FormGroup;
  opciones0a99: number[] = Array.from({ length: 100 }, (_, i) => i);
  showGuaranteeDoc = false;
  isMortgage = false;

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

  constructor(private fb: FormBuilder, private message: NzMessageService) {
    this.validateForm = this.fb.group({
      credit: ['', Validators.required],
      term: [null, [Validators.required, Validators.min(1)]],
      amount: [null, [Validators.required, Validators.min(1000)]],
      guarantee: [''],
      guaranteeValue: [''],
    });
    this.validateForm.get('credit')?.valueChanges.subscribe((value) => {
      this.isMortgage = value === 'hipotecario';
    });
  }

  lastRequestId: string = '';

  async onGuaranteeChange(): Promise<void> {
    const value = this.validateForm.get('guarantee')?.value;
    this.showGuaranteeDoc = value !== 'noGuarantee' && value !== '';

    if (this.showGuaranteeDoc) {
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
          `${environment.REQUESTS_SERVICE_URL}/last`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        this.lastRequestId = response.data?.data?.lastId + 1 || '';
      } catch (error) {
        console.error('Error al consultar la última solicitud:', error);
      }
    }
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

      if (type === 'guaranteeDoc') {
        if (!this.lastRequestId) {
          this.message.error('No se ha obtenido el ID de la última solicitud.');
          return;
        }
        uploadUrl = `${environment.DOCUMENTS_SERVICE_URL}/${this.lastRequestId}/guarantee`;
        getUrl = `${environment.DOCUMENTS_SERVICE_URL}/guarantee/file/${this.lastRequestId}`;
      } else {
        const endpoints: Record<string, string> = {
          ine: `${environment.DOCUMENTS_SERVICE_URL}/ine`,
          birth: `${environment.DOCUMENTS_SERVICE_URL}/birth`,
          address: `${environment.DOCUMENTS_SERVICE_URL}/domicile`,
          //income: `${environment.DOCUMENTS_SERVICE_URL}/income`,
        };
        uploadUrl = endpoints[type];
        getUrl = endpoints[type];
      }

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

  async submitForm(): Promise<void> {
    if (!this.validateForm.valid) {
      const errores: string[] = [];
      let { term, credit } = this.validateForm.value;
      if (credit === 'hipotecario') {
        term = term * 12;
      }

      Object.entries(this.validateForm.controls).forEach(([key, control]) => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });

          switch (key) {
            case 'credit':
              errores.push('Tipo de crédito es obligatorio.');
              break;
            case 'term':
              errores.push('Plazo inválido. Debe estar entre 1 y 120 meses.');
              break;
            case 'amount':
              errores.push(
                'Monto del crédito inválido. Debe ser mayor o igual a $1,000.'
              );
              break;
            case 'guarantee':
              errores.push('Tipo de garantía es obligatorio.');
              break;
            case 'guaranteeValue':
              errores.push('Valor de la garantía no puede ser negativo.');
              break;
          }
        }
      });

      errores.forEach((msg) => this.message.error(msg));
      return;
    }

    const { amount, term, guaranteeValue } = this.validateForm.value;

    if (amount < 1000) {
      this.message.error(
        'El monto del crédito debe ser mayor o igual a $1,000.'
      );
      return;
    }

    if (term < 1) {
      this.message.error('Ingrese un plazo válido.');
      return;
    }

    if (
      this.showGuaranteeDoc &&
      guaranteeValue !== null &&
      guaranteeValue < 0
    ) {
      this.message.error('El valor de la garantía no puede ser negativo.');
      return;
    }
    const documentosRequeridos = ['ine', 'birth', 'address'];
    if (this.showGuaranteeDoc) {
      documentosRequeridos.push('guaranteeDoc');
    }

    const documentosFaltantes = documentosRequeridos.filter(
      (doc) => !this.documentUrls[doc]
    );

    if (documentosFaltantes.length > 0) {
      const nombresDocumentos: Record<string, string> = {
        ine: 'INE',
        birth: 'Acta de nacimiento',
        address: 'Comprobante de domicilio',
        guaranteeDoc: 'Comprobante de garantía',
      };

      documentosFaltantes.forEach((doc) => {
        this.message.error(
          `Falta subir el documento: ${nombresDocumentos[doc]}`
        );
      });

      return;
    }

    const formValues = this.validateForm.value;

    const creditMap: Record<string, number> = {
      personal: 1,
      hipotecario: 2,
      prendario: 3,
    };

    const guaranteeMap: Record<string, number> = {
      mueble: 1,
      inmueble: 2,
      noGuarantee: 0,
    };

    const result = {
      credit_type: creditMap[formValues.credit] || 0,
      amount: formValues.amount,
      loan_term: term,
      guarantee_type: guaranteeMap[formValues.guarantee] || 0,
      guarantee_value: formValues.guaranteeValue || 0,
      url_ine: this.documentUrls['ine'],
      url_birth_certificate: this.documentUrls['birth'],
      url_address: this.documentUrls['address'],
      // url_income: this.documentUrls['income'],
      url_guarantee: this.showGuaranteeDoc
        ? this.documentUrls['guaranteeDoc']
        : null,
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

    const url = `${environment.REQUESTS_SERVICE_URL}`;

    try {
      const response = await axios.post(url, result, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      this.message.success('Solicitud creada correctamente.');
      console.log('Respuesta:', response.data);

      this.validateForm.reset();
      this.documentFiles = {
        ine: null,
        birth: null,
        address: null,
        guaranteeDoc: null,
      };
      this.documentUrls = {
        ine: null,
        birth: null,
        address: null,
        guaranteeDoc: null,
      };
      this.showGuaranteeDoc = false;
      this.lastRequestId = '';
    } catch (error) {
      console.error('Error:', error);
      this.message.error('Hubo un error al crear la solicitud.');
    }
    console.log('Datos para enviar:', result);
  }
}
