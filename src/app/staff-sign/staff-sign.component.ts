import { Component, OnInit, ViewEncapsulation  } from '@angular/core';
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
import { ActivatedRoute } from '@angular/router';

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
export class StaffSignComponent implements OnInit {
  validateForm: FormGroup;
  editMode = false;
  userRole: 'analyst' | 'supervisor' | null = null;

  constructor(
    private fb: FormBuilder,
    private message: NzMessageService,
    private route: ActivatedRoute
  ) {
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

  ngOnInit(): void {
    this.editMode = this.route.snapshot.data['mode'] === 'edit';
    if (!this.editMode || typeof window === 'undefined') return;

    this.userRole = this.getUserRoleFromStorage();
    if (!this.userRole) {
      this.message.error('No se pudo identificar el rol del usuario.');
      return;
    }

    this.validateForm.get('password')?.clearValidators();
    this.validateForm.get('confirmPassword')?.clearValidators();
    this.validateForm.get('password')?.updateValueAndValidity();
    this.validateForm.get('confirmPassword')?.updateValueAndValidity();
    this.validateForm.patchValue({ rol: this.userRole });
    void this.fetchStaffProfile();
  }

  private getUserRoleFromStorage(): 'analyst' | 'supervisor' | null {
    const rawType = localStorage.getItem('typeUser');
    if (!rawType) return null;

    try {
      const parsed = JSON.parse(rawType);
      const role = parsed?._value || parsed;
      return role === 'analyst' || role === 'supervisor' ? role : null;
    } catch {
      return rawType === 'analyst' || rawType === 'supervisor' ? rawType : null;
    }
  }

  private getAccessToken(): string {
    const rawToken = localStorage.getItem('accessToken');
    if (!rawToken) return '';

    try {
      const parsed = JSON.parse(rawToken);
      return parsed?._value || parsed || '';
    } catch {
      return rawToken;
    }
  }

  private async fetchStaffProfile(): Promise<void> {
    if (!this.userRole) return;

    try {
      const endpoint = `${environment.STAFF_SERVICE_URL}/${this.userRole}`;
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${this.getAccessToken()}` },
      });
      const profile = response.data?.data || response.data || {};
      const birthdate = this.formatBirthdate(profile.birthdate);
      const editableProfile = { ...profile };
      delete editableProfile.password;
      delete editableProfile.confirmPassword;
      this.validateForm.patchValue({
        ...editableProfile,
        password: '',
        confirmPassword: '',
        birthdate,
        rol: this.userRole,
      });
    } catch (error) {
      this.message.error('No se pudo cargar la información del colaborador.');
      console.error('Error al obtener perfil de colaborador:', error);
    }
  }

  private formatBirthdate(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
      if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
    }

    const date = new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
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
    if (this.editMode) {
      delete formValue.rol;
      delete formValue.password;
    }

    const [day, month, year] = formValue.birthdate.split('/').map(Number);
    formValue.birthdate = new Date(year, month - 1, day);

    const role = this.editMode ? this.userRole : formValue.rol;
    const url = `${environment.STAFF_SERVICE_URL}/${role}`;

    // 🔐 Obtener Bearer Token
    const token = this.getAccessToken();

    try {
      console.log('Enviando datos:', url);
      const response = this.editMode
        ? await axios.patch(url, formValue, {
            headers: { Authorization: `Bearer ${token}` },
          })
        : await axios.post(url, formValue, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      this.message.success(
        this.editMode
          ? 'Información actualizada correctamente'
          : 'Registro completado correctamente'
      );
      if (!this.editMode) this.validateForm.reset();
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
