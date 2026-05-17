import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzProgressModule } from 'ng-zorro-antd/progress';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule, NzProgressModule],
  templateUrl: './progress-bar.component.html',
  styleUrls: ['./progress-bar.component.css']
})
export class ProgressBarComponent {
  @Input() progress: number = 0; 
  @Input() status: string = ''; 

  isApproved: boolean = false;

  ngOnChanges() {
    this.isApproved = this.status === 'Aprobada';
  }

  getVisualPercent(): number {
    if (this.progress < 33) {
      return 0;
    } else if (this.progress < 66) {
      return 33;
    } else if (this.progress < 100) {
      return 66;
    } else {
      return 100;
    }
  }

  getProgressLabel = (percent: number): string => {
    if (percent < 33) {
      return 'Iniciando';
    } else if (percent < 66) {
      return 'Solicitud enviada';
    } else if (percent < 100) {
      return 'En revisión';
    } else {
      return this.isApproved ? 'Aprobada' : 'Rechazada';
    }
  }
}
