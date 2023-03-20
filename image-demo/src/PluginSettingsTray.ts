import { reactively } from "@reactively/decorate";
import "@spectrum-web-components/accordion/sp-accordion.js";
import { ReactiveLitElement } from "@reactively/lit";
import { dlog } from "berry-pretty";
import { LitElement, PropertyValues } from "lit";
import { html, render, TemplateResult } from "lit-html";
import { createRef, ref } from "lit-html/directives/ref.js";
import { customElement } from "lit/decorators.js";
import Sortable from "sortablejs";
import { appState, appUI, imageDirty } from "./AppState";
import { ImageShaderComponent, InitializedPlugin } from "./ImagePlugins";
import { PluginSettings } from "./PluginSettings";

export interface PluginTrayArgs {
  initPlugins: InitializedPlugin[];
  imageDirty: () => void;
}

/** Panel containing all of the image transform control panel elements */
@customElement("plugin-settings-tray")
export class PluginSettingsTray extends ReactiveLitElement {
  constructor() {
    super();
  }

  private settingsContainer = createRef<HTMLDivElement>();

  override reactiveRender(): TemplateResult {
    return html`
      <sp-accordion>
        <div ${ref(this.settingsContainer)}>${this.pluginSettings}</div>
      </sp-accordion>
    `;
  }

  enabledComponents(): ImageShaderComponent[] {
    const indices = this.sortable?.toArray() || [];
    const components = indices.flatMap(pluginIndex => {
      const found = this.pluginSettings.find(s => s.pluginId === pluginIndex);
      return found && found.isEnabled() ? [found.initPlugin.component] : [];
    });
    return components;
  }

  private sortable: Sortable | undefined = undefined;

  override connectedCallback(): void {
    super.connectedCallback();

    this.updateComplete.then(() => {
      this.sortable = new Sortable(this.settingsContainer.value!, {
        animation: 300,
        dataIdAttr: "data-plugin-index",
        onUpdate: imageDirty,
      });
    });
    appUI.pluginSettings = this;
  }

  @reactively private get pluginSettings(): PluginSettings[] {
    return appState.initializedPlugins.map((initPlugin, i) => {
      return new PluginSettings({
        initPlugin,
        enabled: i === 0,
        imageDirty,
        pluginId: i.toString(),
      });
    });
  }
}
