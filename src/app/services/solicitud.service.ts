import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SolicitudService {
  private solicitud: any = null;

  setSolicitud(data: any) {
    this.solicitud = data;
  }

  getSolicitud() {
    return this.solicitud;
  }

  clearSolicitud() {
    this.solicitud = null;
  }
}
