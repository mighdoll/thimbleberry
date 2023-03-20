import "@spectrum-web-components/accordion/sp-accordion-item.js";
import "@spectrum-web-components/checkbox/sp-checkbox.js";
import { Checkbox } from "@spectrum-web-components/checkbox";
import { LitElement } from "lit";
import { html, TemplateResult } from "lit-html";
import { createRef, ref } from "lit-html/directives/ref.js";
import { customElement, property } from "lit/decorators.js";
import { querySelectorDeep } from "query-selector-shadow-dom";
import { InitializedPlugin } from "./ImagePlugins";

export interface PluginSettingsArgs {
  initPlugin: InitializedPlugin;
  imageDirty: () => void;
  pluginId: string;
  enabled?: boolean;
}

/** 
 * Control panel item for an image transformer plugin,
 * including an enable/disable switch.
*/
@customElement("plugin-settings")
export class PluginSettings extends LitElement {
  static disabledTitle = "opacity: 50%; text-decoration: line-through;";

  @property({ reflect: true, attribute: "data-plugin-index" })
  readonly pluginId!: string;

  readonly initPlugin!: InitializedPlugin;
  private enabled;
  private imageDirty!: () => void;
  private enabledRef = createRef<Checkbox>();

  constructor(params?: PluginSettingsArgs) {
    super();
    if (params) {
      // (no params when called with cloneNode via sortable)
      this.initPlugin = params.initPlugin;
      this.enabled = params.enabled ?? false;
      this.imageDirty = params.imageDirty;
      this.pluginId = params.pluginId;
    }
  }

  isEnabled(): boolean {
    return this.enabled!;
  }

  override updated(): void {
    this.updateComplete.then(() => {
      const button = querySelectorDeep("button", this);
      if (this.enabled) {
        button?.removeAttribute("style");
      } else {
        button?.setAttribute("style", PluginSettings.disabledTitle);
      }
    });
  }

  render(): TemplateResult {
    return html`<sp-accordion-item label="${this.initPlugin.name}">
      <div @pointerdown=${stopPropogation} class="settings-section">
        <div>
          <sp-checkbox
            @change=${this.enableChanged}
            ${ref(this.enabledRef)}
            ?checked=${this.enabled}>
            enable
          </sp-checkbox>
        </div>
        ${this.initPlugin.settingsUI}
      </div>
    </sp-accordion-item>`;
  }

  private enableChanged(): void {
    this.enabled = this.enabledRef.value?.checked ?? false;
    this.imageDirty();
    this.requestUpdate();
  }
}

function stopPropogation(e: Event): void {
  e.stopPropagation();
}
