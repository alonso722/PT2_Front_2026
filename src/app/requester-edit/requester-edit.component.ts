import { Component, OnInit, Inject, PLATFORM_ID, ViewEncapsulation  } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService, NzMessageModule } from 'ng-zorro-antd/message';
import { NavBarComponent } from '../misc/navBar/nav-bar/nav-bar.component';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import axios from 'axios';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-requester-edit',
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzCheckboxModule,
    NzInputNumberModule,
    NzMessageModule,
    NavBarComponent,
    NzToolTipModule
  ],
  templateUrl: './requester-edit.component.html',
  styleUrl: './requester-edit.component.css',
})
export class RequesterEditComponent implements OnInit {
  validateForm: FormGroup;
  isBrowser = false;
  userId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private message: NzMessageService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.validateForm = this.fb.group(
      {
        civil_status: ['', Validators.required],
        education_level: ['', Validators.required],
        occupation_type: ['', Validators.required],
        gender: ['', Validators.required],
        monthly_income: [null, [Validators.required, Validators.min(0)]],
        has_own_car: [false],
        has_own_realty: [false],
        count_children: [0, [Validators.required, Validators.min(0)]],
        count_adults: [0, [Validators.required, Validators.min(0)]],
        count_family_members: [0, [Validators.required, Validators.min(0)]],
        address: ['', Validators.required],
        days_employed: [null, [Validators.required, Validators.min(0)]],
        food_expenses: [null, [Validators.required, Validators.min(0)]],
        education_expenses: [null, [Validators.required, Validators.min(0)]],
        transport_expenses: [null, [Validators.required, Validators.min(0)]],
        utilities_expenses: [null, [Validators.required, Validators.min(0)]],
        health_expenses: [null, [Validators.required, Validators.min(0)]],
        maintenance_expenses: [null, [Validators.required, Validators.min(0)]],
        rent_expenses: [null, [Validators.min(0)]],
      },
      { validators: [this.familyMembersValidator] }
    );
    this.validateForm.get('count_children')?.valueChanges.subscribe(() => {
      this.updateFamilyMembersCount();
    });
    this.validateForm.get('count_adults')?.valueChanges.subscribe(() => {
      this.updateFamilyMembersCount();
    });
    this.validateForm.get('has_own_realty')?.valueChanges.subscribe((isOwner) => {
      const rentControl = this.validateForm.get('rent_expenses');
      if (isOwner) {
        rentControl?.clearValidators();  
        rentControl?.setValue(null);    
      } else {
        rentControl?.setValidators([Validators.required, Validators.min(0)]);
      }
      rentControl?.updateValueAndValidity();
    });
    this.updateFamilyMembersCount();
  }

  ngOnInit(): void {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.fetchSolicitudes();
    }
  }

  async fetchSolicitudes(): Promise<void> {
    try {
      const rawToken = localStorage.getItem('accessToken');
      let token = '';

      if (rawToken) {
        try {
          const parsed = JSON.parse(rawToken);
          token = parsed._value || '';
          console.log('Token obtenido:', token);
        } catch (e) {
          token = rawToken;
        }
      }

      const endpoint = `${environment.REQUESTER_SERVICE_URL}`;
      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response.data?.data || {};
      console.log('Datos recibidos:', data);

      this.userId = data.sub;

      const allowedKeys = Object.keys(this.validateForm.controls);
      const filteredData: any = {};

      allowedKeys.forEach((key) => {
        if (data.hasOwnProperty(key)) {
          filteredData[key] = data[key];
        }
      });

      this.validateForm.patchValue(filteredData);
    } catch (error) {
      console.error('Error al obtener solicitudes:', error);
    }
  }

    private updateFamilyMembersCount(): void {
    const children = this.validateForm.get('count_children')?.value || 0;
    const adults = this.validateForm.get('count_adults')?.value || 0;
    const total = children + adults;
    this.validateForm.get('count_family_members')?.setValue(total, { emitEvent: false });
  }

  familyMembersValidator(form: FormGroup) {
    const children = form.get('count_children')?.value || 0;
    const adults = form.get('count_adults')?.value || 0;
    const total = form.get('count_family_members')?.value || 0;

    return children + adults <= total ? null : { familyMismatch: true };
  }

  async submitForm(): Promise<void> {
    if (this.validateForm.valid) {
      const formValue = { ...this.validateForm.value };
      console.log(formValue);
      formValue.monthly_income = Number(formValue.monthly_income);

      const rawToken = localStorage.getItem('accessToken');
      let token = '';

      if (rawToken) {
        try {
          const parsed = JSON.parse(rawToken);
          token = parsed._value || '';
          console.log('Token obtenido:', token);
        } catch (e) {
          token = rawToken;
        }
      }

      try {
        if (!this.userId) {
          this.message.error(
            'No se pudo identificar al usuario para actualizar.'
          );
          return;
        }

        const url = `${environment.REQUESTER_SERVICE_URL}/${this.userId}`;
        await axios.patch(url, formValue, {
          headers: { Authorization: `Bearer ${token}` },
        });

        this.message.success('Formulario enviado correctamente');
      } catch (error: any) {
        console.error('Error al enviar formulario:', error);

        const status = error.response?.status;
        const backendMessage = error.response?.data?.message;
      }
    } else {
      if (this.validateForm.errors?.['familyMismatch']) {
        this.message.error(
          'La suma de niños y adultos no puede ser mayor que los miembros del hogar'
        );
        return;
      }

      Object.values(this.validateForm.controls).forEach((control) => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
    }
  }

  getFieldLabel(field: string): string {
    const labels: { [key: string]: string } = {
      civil_status: 'Estado civil',
      education_level: 'Nivel educativo',
      gender: 'Género',
      monthly_income: 'Ingreso mensual',
      has_own_car: '¿Cuenta con automóvil?',
      has_own_realty: '¿Cuenta con propiedad?',
      count_children: 'Número de hijos',
      count_adults: 'Número de adultos',
      count_family_members: 'Miembros en el hogar',
      address: 'Dirección',
      days_employed: 'Días trabajando',
    };
    return labels[field] || field;
  }
}
