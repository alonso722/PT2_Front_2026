import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import axios from 'axios';
import { LocalStorageService } from 'angular-web-storage';
import { environment } from '../../../../environments/environment';

interface Message {
  time: string;
  sender: 'requester' | 'analyst' | 'supervisor';
  text: string;
  nombreCorto?: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, NzInputModule, NzButtonModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
})
export class ChatComponent implements OnInit, OnChanges {
  @Input() userType: 'requester' | 'analyst' | 'supervisor' = 'requester';
  @Input() chat: Message[] = [];
  @Input() id: number = 0;
  @Input() nombreCorto: string = 'Usuario';
  @Output() messageSent = new EventEmitter<void>();

  localMessages: Message[] = [];
  newMessage: string = '';

  constructor(private localStorage: LocalStorageService) {}

  ngOnInit(): void {
    if (!this.userType) {
      this.userType = this.getUserTypeFromStorage();
    }
    this.localMessages = [...this.chat];
    console.log('🔵 ngOnInit - Chat cargado:', this.localMessages);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chat'] && changes['chat'].currentValue) {
      this.localMessages = [...this.chat];
      console.log(
        'ngOnChanges - Chat actualizado desde padre:',
        this.localMessages
      );
    }
  }

  async sendMessage(): Promise<void> {
    this.nombreCorto = this.getUserNameFromStorage();
    console.log('🔵 Enviando mensaje:', this.nombreCorto);
    if (this.newMessage.trim()) {
      const newMsg: Message = {
        sender: this.userType,
        text: this.newMessage,
        time: this.formatTime(new Date()),
        nombreCorto: this.nombreCorto,
      };
      console.log('Enviando mensaje:', newMsg);

      const rawToken = localStorage.getItem('accessToken');
      let token = '';

      if (rawToken) {
        try {
          const parsed = JSON.parse(rawToken);
          token = parsed._value || '';
        } catch (e) {
          token = rawToken;
        }
      }

      const url = `${environment.REQUESTS_SERVICE_URL}/${this.id}`;

      try {
        const updatedChat = [newMsg];

        await axios.patch(
          url,
          { chat: updatedChat },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        this.messageSent.emit();
        this.newMessage = '';
      } catch (error) {
        console.error('Error al enviar mensaje:', error);
      }
    }
  }

  formatTime(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(
      date.getMonth() + 1
    )}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}:${pad(date.getSeconds())}`;
  }

  getUserTypeFromStorage(): 'requester' | 'analyst' | 'supervisor' {
    const rawType = localStorage.getItem('typeUser');
    try {
      const parsed = JSON.parse(rawType || '{}');
      return parsed._value || rawType || 'requester';
    } catch {
      return (rawType as any) || 'requester';
    }
  }

  getUserNameFromStorage(): string {
    const rawNmae = this.localStorage.get('nameUser');
    console.log('🔵 Nombre de usuario desde localStorage:', rawNmae);
    try {
      const parsed = JSON.parse(rawNmae || '{}');
      return parsed._value || rawNmae || 'Usuario Anonimo';
    } catch {
      return (rawNmae as any) || 'Usuario Anonimo';
    }
  }

  getLabel(sender: string): string {
    switch (sender) {
      case 'requester':
        return 'Solicitante';
      case 'analyst':
        return 'Analista';
      case 'supervisor':
        return 'Supervisor';
      default:
        return 'Usuario';
    }
  }
}
