export function HighlightText({ text, query }: { text: string; query: string }) {
	if (!query) return <>{text}</>;
	const idx = text.toLowerCase().indexOf(query.toLowerCase());
	if (idx === -1) return <>{text}</>;
	return (
		<>
			{text.slice(0, idx)}
			<mark className="rounded-[2px] bg-[color:var(--theme-accent)]/25 text-inherit">
				{text.slice(idx, idx + query.length)}
			</mark>
			{text.slice(idx + query.length)}
		</>
	);
}
