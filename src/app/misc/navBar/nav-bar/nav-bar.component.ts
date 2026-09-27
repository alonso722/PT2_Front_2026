import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { environment } from '../../../../environments/environment';
import axios from 'axios';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-nav-bar',
  standalone: true,
  imports: [
    CommonModule,
    NzLayoutModule,
    NzMenuModule,
    NzIconModule
  ],
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent implements OnInit {
  selectedKey = '';
  userType: 'requester' | 'analyst' | 'supervisor' | null = null;
  isCollapsed = true;
  solicitudesOriginal: any[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.updateSelectedKey(this.router.url);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateSelectedKey(event.urlAfterRedirects);
      });

    if (typeof window !== 'undefined') {
      this.userType = this.getUserTypeFromStorage();

      console.log('Tipo de usuario:', this.userType);

      if (this.userType === 'requester') {
        this.fetchSolicitudes();
      }
    }
  }

  private updateSelectedKey(url: string): void {
    if (!url) {
      return;
    }

    if (url.startsWith('/dashboard')) {
      this.selectedKey = 'dashboard';
    } else if (url.startsWith('/requester-edit')) {
      this.selectedKey = 'requester-edit';
    } else if (url.startsWith('/form')) {
      this.selectedKey = 'form';
    } else if (url.startsWith('/sign-staff')) {
      this.selectedKey = 'sign-staff';
    } else if (url.startsWith('/login')) {
      this.selectedKey = 'login';
    } else {
      this.selectedKey = '';
    }
  }

  logout(): void {
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('typeUser');
      localStorage.removeItem('nameUser');
    } catch (e) {
      console.warn('Error removing token from storage', e);
    }

    this.router.navigate(['/']);
  }

  async fetchSolicitudes(): Promise<void> {
    try {
      const rawToken = localStorage.getItem('accessToken');
      const type = localStorage.getItem('typeUser');
      let token = '';

      if (rawToken) {
        try {
          const parsed = JSON.parse(rawToken);
          token = parsed._value || parsed || '';
        } catch {
          token = rawToken;
        }
      }

      if (type) {
        try {
          const parsed = JSON.parse(type);
          this.userType = (parsed._value || parsed) as
            'requester' | 'analyst' | 'supervisor';
        } catch {
          this.userType = type as
            'requester' | 'analyst' | 'supervisor';
        }
      }

      if (this.userType === 'requester') {
        const endpoint = `${environment.REQUESTS_SERVICE_URL}/requester`;

        const response = await axios.get(endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        this.solicitudesOriginal = response.data.data || [];

        console.log(
          'Solicitudes obtenidas:',
          this.solicitudesOriginal
        );
      } else {
        console.log(
          'El usuario no es requester, no se consultan solicitudes.'
        );
      }
    } catch (error) {
      console.error('Error al obtener solicitudes:', error);
    }
  }

  get hasActiveSolicitud(): boolean {
    return this.solicitudesOriginal.some(
      (sol) => sol.status === 1 || sol.status === 2
    );
  }

  getUserTypeSpanish(): string {
    switch (this.userType) {
      case 'requester':
        return 'Solicitante';
      case 'analyst':
        return 'Analista';
      case 'supervisor':
        return 'Supervisor';
      default:
        return '';
    }
  }

  toggleCollapsed(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  getUserTypeFromStorage(): 'requester' | 'analyst' | 'supervisor' {
    if (typeof window === 'undefined') {
      return 'requester';
    }

    const rawType = localStorage.getItem('typeUser');

    if (!rawType) {
      return 'requester';
    }

    try {
      const parsed = JSON.parse(rawType);
      const userType = parsed._value || parsed;

      if (
        userType === 'analyst' ||
        userType === 'supervisor' ||
        userType === 'requester'
      ) {
        return userType;
      }

      return 'requester';
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

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}