import { Routes } from '@angular/router';
import { DashboardComponent } from './layout/dasboard/dashboard/dashboard.component';
import { AboutComponent } from './about/about/about.component';
import { CreditFormComponent } from './layout/credit_form/credit-form/credit-form.component';
import { SignUpComponent } from './sign-up/sign-up.component'; 
import { DetailsPageComponent } from './details-page/details-page.component';
import { LoginComponent } from './auth/login/login/login.component';
import { StaffSignComponent } from './staff-sign/staff-sign.component';
import { RequesterEditComponent } from './requester-edit/requester-edit.component';

export const routes: Routes = [
    {
        title: "Login",
        path: '',
        component: LoginComponent,
    },
    {title: "Dasboard", path:'dashboard' , component: DashboardComponent},
    {title: "Dasboard", path:'about' , component: AboutComponent},
    {title: "Dasboard", path:'form' , component: CreditFormComponent},
    {title: "Registro", path:'sign-up' , component: SignUpComponent},
    {title: "Detalles", path:'details' , component: DetailsPageComponent},
    {title: "Registro de colaboradores", path:'sign-staff', component: StaffSignComponent},
    {title: "Editar informacion", path:'requester-edit', component: RequesterEditComponent},
    {
        title: "Login",
        path: '*',
        component: LoginComponent,
    },
     {
        title: "Login",
        path: '**',
        component: LoginComponent,
    },
];
