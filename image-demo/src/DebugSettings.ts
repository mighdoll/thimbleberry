import { Checkbox } from "@spectrum-web-components/checkbox";
import "@spectrum-web-components/checkbox/sp-checkbox.js";
import "@spectrum-web-components/overlay/overlay-trigger.js";
import { Toast } from "@spectrum-web-components/toast";
import "@spectrum-web-components/toast/sp-toast.js";
import "@spectrum-web-components/tooltip/sp-tooltip.js";
import { css, LitElement } from "lit";
import { html, TemplateResult } from "lit-html";
import { customElement } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { destroyGpuTiming, initGpuTiming } from "thimbleberry/shader-util";
import { appState } from "./AppState";
import { savedSettings, updateSavedSettings } from "./SavedSettings";

/** debug settings UI, incl. contoller for gpu performance logging */
@customElement("debug-settings")
export class DebugSettings extends LitElement {
  static styles = css`
    ::host {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      flex-wrap: nowrap;
    }
    .sample-media {
      width: 120px;
      height: 90px;
      padding: 8px;
    }
    .thumb {
      padding: 4px;
    }
    .thumb-label {
      justify-content: center;
      display: flex;
      margin: 0;
    }
  `;

  private noTimeToastRef = createRef<Toast>();

  private perfCheck(e: Event & { target: Checkbox }): void {
    const checkbox = e.target;
    if (checkbox.checked) {
      if (appState.gpuDevice?.features.has("timestamp-query")) {
        initGpuTiming(appState.gpuDevice);
        updateSavedSettings({ performanceLog: true });
      } else {
        updateSavedSettings({ performanceLog: false });
        const toast = this.noTimeToastRef.value;
        if (toast) {
          toast.open = true;
          checkbox.indeterminate = true;
          checkbox.invalid = true;
        }
      }
    } else {
      updateSavedSettings({ performanceLog: false });
      destroyGpuTiming();
    }
  }

  private checkboxRef(el: Element | undefined): void {
    if (el) {
      const checkbox = el as Checkbox;
      if (savedSettings().performanceLog) {
        checkbox.checked = true;
      }
    }
  }

  override render(): TemplateResult {
    return html`
      <div>
        <overlay-trigger>
          <sp-checkbox ${ref(this.checkboxRef)} @change=${this.perfCheck} slot="trigger">
            performance log
          </sp-checkbox>
          <sp-tooltip slot="hover-content" placement="right">
            Reports GPU performance in the browser debug console
          </sp-tooltip>
        </overlay-trigger>
      </div>
      <sp-toast ${ref(this.noTimeToastRef)} variant="negative">
        No timestamp query support available.
        <br />
        (Launch the browser with the flag --disable-dawn-features=disallow_unsafe_apis)
      </sp-toast>
    `;
  }
}
