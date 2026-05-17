import { Component } from '@angular/core';
import { NavBarComponent } from '../../../misc/navBar/nav-bar/nav-bar.component';
import { CardComponent } from '../../../misc/cards/card/card.component';
import { NzMenuModule } from 'ng-zorro-antd/menu';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NavBarComponent, CardComponent, NzMenuModule, ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {

}
