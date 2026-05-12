<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	type CheckboxProps = WithElementRef<
		Omit<HTMLInputAttributes, "type"> & {
			indeterminate?: boolean;
		},
		HTMLInputElement
	>;

	let {
		ref = $bindable<HTMLInputElement | null>(null),
		checked = $bindable(false),
		indeterminate = $bindable(false),
		class: className,
		...restProps
	}: CheckboxProps = $props();

	$effect(() => {
		if (ref) {
			ref.indeterminate = Boolean(indeterminate);
		}
	});
</script>

<input
	bind:this={ref}
	data-slot="checkbox"
	type="checkbox"
	class={cn(
		"peer size-4 shrink-0 rounded-sm border border-input bg-background shadow-xs transition-[color,box-shadow] outline-none",
		"checked:border-primary checked:bg-primary checked:text-primary-foreground",
		"focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
		"aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
		"disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	bind:checked
	{...restProps}
/>
