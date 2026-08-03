import { Component, EventEmitter, Output } from '@angular/core';
import { DeviceInfoService } from '../device-info';
import { IDeviceInfo } from './device-info.model';

@Component({
  selector: 'app-device-info',
  imports: [],
  templateUrl: './device-info.html',
  styleUrl: './device-info.scss',
})
export class DeviceInfo {
  @Output() collected = new EventEmitter<IDeviceInfo>();
 
  deviceInfo!: IDeviceInfo;
 
  constructor(private readonly deviceInfoService: DeviceInfoService) {}
 
  ngOnInit(): void {
    this.deviceInfo = this.deviceInfoService.collect();
    setTimeout(() => {
        console.warn('Device Info:', this.deviceInfo);
    }, 1000);
    this.collected.emit(this.deviceInfo);
  }

}
