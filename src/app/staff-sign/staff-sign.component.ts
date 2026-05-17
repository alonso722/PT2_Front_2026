import { Component, ViewEncapsulation  } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { NavBarComponent } from '../misc/navBar/nav-bar/nav-bar.component';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService, NzMessageModule } from 'ng-zorro-antd/message';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import axios from 'axios';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-staff-sign',
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    NavBarComponent,
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzMessageModule,
    NzToolTipModule,
    NzIconModule,
    NzPopoverModule
  ],
  templateUrl: './staff-sign.component.html',
  styleUrls: ['./staff-sign.component.css'],
})
export class StaffSignComponent {
  validateForm: FormGroup;

  constructor(private fb: FormBuilder, private message: NzMessageService) {
    this.validateForm = this.fb.group(
      {
        firstname: ['', Validators.required],
        lastname: ['', Validators.required],
        curp: ['', [Validators.required, this.curpValidator]],
        rfc: ['', [Validators.required, this.rfcValidator]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, this.passwordValidator]],
        confirmPassword: ['', Validators.required],
        address: ['', Validators.required],
        gender: ['', Validators.required],
        birthdate: ['', [Validators.required, this.birthdateValidator]],
        rol: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  curpValidator(control: AbstractControl) {
    const regex =
      /^[A-Z]{1}[AEIOU]{1}[A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM]{1}[A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]{1}\d{1}$/i;
    return control.value && !regex.test(control.value)
      ? { invalidCurp: true }
      : null;
  }

  private rfcCurpConsistencyCheck(): boolean {
    const rfc = this.validateForm.get('rfc')?.value;
    const curp = this.validateForm.get('curp')?.value;
    if (!rfc || !curp) return true;

    const rfcPrefix = rfc.substring(0, 4);
    const rfcDate = rfc.substring(4, 10);
    const curpPrefix = curp.substring(0, 4);
    const curpDate = curp.substring(4, 10);

    return rfcPrefix === curpPrefix && rfcDate === curpDate;
  }

  rfcValidator(control: AbstractControl) {
    const regex =
      /^([A-ZÑ&]{3,4}) ?-? ?(\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])) ?-? ?([A-Z\d]{3})$/i;
    return control.value && !regex.test(control.value)
      ? { invalidRfc: true }
      : null;
  }

  passwordValidator(control: AbstractControl) {
    const regex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return control.value && !regex.test(control.value)
      ? { weakPassword: true }
      : null;
  }

    showPassword = false;
  showConfirmPassword = false;

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  preventClipboardAction(event: ClipboardEvent): void {
    event.preventDefault();
  }


  birthdateValidator(control: AbstractControl) {
    const value = control.value;
    if (!value) return null;
    const regex = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
    if (!regex.test(value)) return { invalidFormat: true };

    const [day, month, year] = value.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
      ? { invalidDate: true }
      : null;
  }

  passwordMatchValidator(form: AbstractControl) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  async submitForm(): Promise<void> {
        if (!this.rfcCurpConsistencyCheck()) {
      this.message.error('El RFC no coincide con la CURP. Verifica que pertenezcan a la misma persona.');
      return;
    }
    if (this.validateForm.invalid) {
      this.handleErrors();
      return;
    }

    const formValue = { ...this.validateForm.value };
    delete formValue.confirmPassword;

    const [day, month, year] = formValue.birthdate.split('/').map(Number);
    formValue.birthdate = new Date(year, month - 1, day);

    const url =
      formValue.rol === 'supervisor'
        ? `${environment.STAFF_SERVICE_URL}/supervisor`
        : `${environment.STAFF_SERVICE_URL}/analyst`;

    // 🔐 Obtener Bearer Token
    const rawToken = localStorage.getItem('accessToken');
    let token = '';

    if (rawToken) {
      try {
        const parsed = JSON.parse(rawToken);
        token = parsed._value || '';
      } catch {
        token = rawToken;
      }
    }

    try {
      console.log('Enviando datos:', url);
      const response = await axios.post(url, formValue, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      this.message.success('Registro completado correctamente');
      this.validateForm.reset();
      console.log('Respuesta:', response.data);
    } catch (error) {
      this.message.error('Error al registrar al colaborador');
      console.error(error);
    }
  }

  private handleErrors(): void {
    if (this.validateForm.errors?.['mismatch']) {
      this.message.error('Las contraseñas no coinciden');
      return;
    }

    for (const key in this.validateForm.controls) {
      const control = this.validateForm.get(key);
      if (control && control.errors) {
        if (control.errors['required']) {
          this.message.error(`El campo ${key} es obligatorio`);
        } else if (control.errors['invalidCurp']) {
          this.message.error('CURP con formato inválido');
        } else if (control.errors['invalidRfc']) {
          this.message.error('RFC con formato inválido');
        } else if (control.errors['weakPassword']) {
          this.message.error(
            'La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y símbolos'
          );
        } else if (control.errors['invalidFormat']) {
          this.message.error(
            'Fecha de nacimiento con formato inválido (DD/MM/AAAA)'
          );
        } else if (control.errors['invalidDate']) {
          this.message.error('Fecha de nacimiento inválida');
        }
        break;
      }
    }
  }
}
