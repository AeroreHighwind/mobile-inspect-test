import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';
import { BootStep, bootSteps } from '../../utils/data/loading-screen';
import { getDayPart } from '../../utils/functions/getDayPart';

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
  private readonly lineDelay = 100;
  private readonly valueDelay = 90;
  private readonly bootSteps = bootSteps;
  public readonly finished = signal(false);
  public readonly visibleSteps = signal<DisplayBootStep[]>([]);
  @Output() setupFinished = new EventEmitter<void>();

  ngOnInit() {
    this.handleBootsteps()
  }

  private async handleBootsteps(): Promise<void> {
    console.warn('Beggining System Setup')
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
        console.log(`${current.label}: ${current.value}`)
      }
      await this.sleep(this.lineDelay);
      
      if(this.visibleSteps().length === bootSteps.length) this.emitFinish()
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

  public emitFinish() {
    this.finished.update(() => true)
    console.warn('System Setup has finished')
    console.info(`Good ${getDayPart()}, Number 21`)
    setTimeout(() => {
         this.setupFinished.emit()
    }, 500);
  }

}