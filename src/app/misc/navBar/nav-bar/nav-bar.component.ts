import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { environment } from '../../../../environments/environment';
import axios from 'axios';

@Component({
  selector: 'app-nav-bar',
  standalone: true,
  imports: [CommonModule, NzLayoutModule, NzMenuModule, NzIconModule],
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent implements OnInit {
  userType: 'requester' | 'analyst' | 'supervisor' = 'requester';
  isCollapsed = true;
  solicitudesOriginal: any[] = [];

  constructor(private router: Router) {}

ngOnInit(): void {
  if (typeof window !== 'undefined') {
    this.userType = this.getUserTypeFromStorage() as 'requester' | 'analyst' | 'supervisor';

    console.log('Tipo de usuario:', this.userType);

    if (this.userType === 'requester') {
      this.fetchSolicitudes();
    }
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
    this.userType = (parsed._value || parsed) as 'requester' | 'analyst' | 'supervisor';
  } catch (e) {
    this.userType = type as 'requester' | 'analyst' | 'supervisor';
  }
}


    // 🔹 Solo ejecuta el fetch si es requester
    if (this.userType === 'requester') {
      const endpoint = `${environment.REQUESTS_SERVICE_URL}/requester`;  
      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      this.solicitudesOriginal = response.data.data || [];
      console.log('Solicitudes obtenidas:', this.solicitudesOriginal);
    } else {
      console.log('El usuario no es requester, no se consultan solicitudes.');
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
    switch(this.userType) {
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
    if (typeof window === 'undefined') return 'requester';

    const rawType = localStorage.getItem('typeUser');
    if (!rawType) return 'requester';

    try {
      const parsed = JSON.parse(rawType);
      const userType = parsed._value || parsed;
      if (userType === 'analyst' || userType === 'supervisor' || userType === 'requester') {
        return userType;
      }
      return 'requester';
    } catch {
      if (rawType === 'analyst' || rawType === 'supervisor' || rawType === 'requester') {
        return rawType;
      }
      return 'requester';
    }
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
