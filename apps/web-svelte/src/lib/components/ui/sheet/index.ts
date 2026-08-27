import { Dialog as SheetPrimitive } from "bits-ui";

import Title from "./sheet-title.svelte";
import Header from "./sheet-header.svelte";
import Overlay from "./sheet-overlay.svelte";
import Content from "./sheet-content.svelte";
import Description from "./sheet-description.svelte";

const Root = SheetPrimitive.Root;
const Portal = SheetPrimitive.Portal;
const Trigger = SheetPrimitive.Trigger;
const Close = SheetPrimitive.Close;

export {
	Root,
	Title,
	Portal,
	Header,
	Trigger,
	Overlay,
	Content,
	Description,
	Close,
	//
	Root as Sheet,
	Title as SheetTitle,
	Portal as SheetPortal,
	Header as SheetHeader,
	Trigger as SheetTrigger,
	Overlay as SheetOverlay,
	Content as SheetContent,
	Description as SheetDescription,
	Close as SheetClose,
};
