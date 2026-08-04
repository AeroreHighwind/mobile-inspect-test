import { Component, OnInit, signal } from '@angular/core';
import { BootStep, bootSteps } from '../../utils/data/loading-screen';

interface DisplayBootStep extends BootStep {
  displayedLabel: string;
  displayedValue: string;
  showValue: boolean;
}

@Component({
  selector: 'app-loading',
  templateUrl: './loading.html',
  styleUrl: './loading.scss',
})
export class Loading implements OnInit {

  private readonly typingSpeed = 18;
  private readonly lineDelay = 120;
  private readonly valueDelay = 90;

  private readonly bootSteps = bootSteps;

  readonly visibleSteps = signal<DisplayBootStep[]>([]);

  async ngOnInit() {

    for (const step of this.bootSteps) {

      const current: DisplayBootStep = {
        ...step,
        displayedLabel: '',
        displayedValue: '',
        showValue: false
      };

      this.visibleSteps.update(v => [...v, current]);

      await this.typeText(current, 'label');

      if (step.value) {

        await this.sleep(this.valueDelay);

        current.showValue = true;

        this.visibleSteps.update(v => [...v]);

        await this.typeText(current, 'value');

      }

      await this.sleep(this.lineDelay);

    }

  }

  private async typeText(
    step: DisplayBootStep,
    field: 'label' | 'value'
  ) {

    const text = field === 'label'
      ? step.label
      : step.value ?? '';

    for (let i = 0; i < text.length; i++) {

      if (field === 'label') {

        step.displayedLabel += text[i];

      } else {

        step.displayedValue += text[i];

      }

      this.visibleSteps.update(v => [...v]);

      await this.sleep(this.typingSpeed);

    }

  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}