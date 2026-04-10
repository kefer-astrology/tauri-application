import Doc from "./Doc.svelte";
import Folder from "./Folder.svelte";
import Save from "./Save.svelte";
import Upload from "./Upload.svelte";
import Radix from "./Radix.svelte";
import Table from "./Table.svelte";
import Info from "./Info.svelte";
import Transits from "./Transits.svelte";
import Dynamic from "./Dynamic.svelte";
import Revolution from "./Revolution.svelte";
import Star from "./Star.svelte";
import Settings from "./Settings.svelte";

export const iconMap = {
  new: Doc,
  load: Folder,
  save: Save,
  export: Upload,
  radix: Radix,
  aspects: Table,
  info: Info,
  transits: Transits,
  dynamic: Dynamic,
  revolution: Revolution,
  favorite: Star,
  settings: Settings,
} as const;

export type IconId = keyof typeof iconMap;
