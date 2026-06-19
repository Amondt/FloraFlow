import { Component, input } from '@angular/core';

@Component({
  selector: 'app-weather-advisory-banner',
  standalone: true,
  templateUrl: './weather-advisory-banner.html',
})
export class WeatherAdvisoryBannerComponent {
  readonly icon = input.required<string>();
  readonly ariaLabel = input.required<string>();
  readonly heading = input.required<string>();
  readonly body = input.required<string>();
}
