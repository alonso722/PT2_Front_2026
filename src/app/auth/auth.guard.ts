import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): boolean | UrlTree {
    if (typeof window === 'undefined') {
      return true;
    }

    const rawToken = window.localStorage.getItem('accessToken');

    if (!rawToken) {
      return this.router.parseUrl('/');
    }

    try {
      const parsed = JSON.parse(rawToken);
      const token = parsed?._value;

      if (token) {
        return true;
      }
    } catch {
      return this.router.parseUrl('/');
    }

    return this.router.parseUrl('/');
  }
}