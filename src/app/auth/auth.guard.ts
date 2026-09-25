import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean | UrlTree {
    try {
      const rawToken = localStorage.getItem('accessToken');
      if (!rawToken) {
        return this.router.parseUrl('/');
      }

      // Some code paths store a raw string, others store JSON via angular-web-storage
      let token = rawToken;
      try {
        const parsed = JSON.parse(rawToken);
        token = parsed._value || parsed;
      } catch {
        token = rawToken;
      }

      if (!token) {
        return this.router.parseUrl('/');
      }

      return true;
    } catch (e) {
      return this.router.parseUrl('/');
    }
  }
}
