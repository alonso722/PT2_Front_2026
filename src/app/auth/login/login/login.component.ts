import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  FormsModule,
  ReactiveFormsModule,
  AbstractControl,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NzMessageService, NzMessageModule } from 'ng-zorro-antd/message';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { TopMenuComponent } from '../../../misc/topMenu/top-menu/top-menu.component';
import { LocalStorageService } from 'angular-web-storage';
import axios from 'axios';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NzMenuModule,
    NzFormModule,
    NzButtonModule,
    ReactiveFormsModule,
    FormsModule,
    NzCheckboxModule,
    NzInputModule,
    NzIconModule,
    TopMenuComponent,
    NzMessageModule,
    NzModalModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  validateForm: FormGroup;
  isRecoverModalVisible = false;
  emailSent = false;

  recoverForm: FormGroup;
  confirmForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private localStorage: LocalStorageService,
    private http: HttpClient,
    private message: NzMessageService
  ) {
    this.validateForm = this.fb.group({
      userName: ['', [Validators.required]],
      password: ['', [Validators.required]],
      remember: [true],
    });

    this.recoverForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    this.confirmForm = this.fb.group(
      {
        newPassword: [
          '',
          [
            Validators.required,
            Validators.pattern(
              /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/
            ),
          ],
        ],
        confirmPassword: ['', [Validators.required]],
        confirmationCode: ['', [Validators.required]],
      },
      { validators: this.passwordsMatchValidator }
    );
  }

  passwordVisible = false;

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  openRecoverModal(): void {
    this.recoverForm.reset();
    this.confirmForm.reset();
    this.emailSent = false;
    this.isRecoverModalVisible = true;
  }

  handleRecoverCancel(): void {
    this.isRecoverModalVisible = false;
  }

  passwordsMatchValidator(
    group: AbstractControl
  ): { [key: string]: boolean } | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  async sendRecoveryEmail() {
    const email = this.recoverForm.value.email;

    try {
      await this.http
        .post(`${environment.AUTH_SERVICE_URL}/auth/forgot-password`, {
          email,
        })
        .toPromise();
      this.message.success('Correo enviado con éxito');
      this.emailSent = true;
    } catch (error: any) {
      const msg = error?.error?.message || 'Error al enviar correo.';
      this.message.error(msg);
    }
  }

  async confirmNewPassword() {
    const body = {
      email: this.recoverForm.value.email,
      confirmationCode: this.confirmForm.value.confirmationCode,
      newPassword: this.confirmForm.value.newPassword,
    };

    try {
      await this.http
        .post(`${environment.AUTH_SERVICE_URL}/confirm-password`, body)
        .toPromise();
      this.message.success('Contraseña actualizada');
      this.isRecoverModalVisible = false;
    } catch (error: any) {
      const msg = error?.error?.message || 'Error al cambiar la contraseña.';
      this.message.error(msg);
    }
  }

  navigateToSignUp(): void {
    this.router.navigate(['/sign-up']);
  }

  submitForm(): void {
    if (this.validateForm.valid) {
      const { userName, password } = this.validateForm.value;
        this.login(userName, password);
    } else {
      Object.values(this.validateForm.controls).forEach((control) => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
    }
  }

  async login(email: string, password: string) {
    try {
      const url = `${environment.AUTH_SERVICE_URL}/login`;
      console.log("intenta enviar ", url)
      const response = await axios.post(url, { email, password });
      const token = response.data.data.accessToken;

      this.localStorage.set('accessToken', token);

      const parseJwt = (token: string) => {
        try {
          const base64Payload = token.split('.')[1];
          const payload = atob(
            base64Payload.replace(/-/g, '+').replace(/_/g, '/')
          );
          return JSON.parse(payload);
        } catch {
          return null;
        }
      };

      const payload = parseJwt(token);
      const group = payload?.['cognito:groups']?.[0] || 'normal';
      this.localStorage.set('typeUser', group);
      this.localStorage.set('nameUser', payload?.name || 'Usuario');

      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      const serverMessage = error?.response?.data?.message;
      const errorMessages: Record<string, string> = {
        'User is not confirmed.':
          'El usuario no está confirmado. Por favor verifica tu correo.',
        'invalid password': 'Contraseña no válida.',
        'Incorrect username or password.': 'Datos erróneos.',
      };

      const msg =
        errorMessages[serverMessage] ||
        'Ocurrió un error durante el inicio de sesión.';
      this.message.error(msg);
    }
  }
}
