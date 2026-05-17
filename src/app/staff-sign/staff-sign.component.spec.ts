import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StaffSignComponent } from './staff-sign.component';

describe('StaffSignComponent', () => {
  let component: StaffSignComponent;
  let fixture: ComponentFixture<StaffSignComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffSignComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(StaffSignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
