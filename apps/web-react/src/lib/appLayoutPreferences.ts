const MONOCHROME_KEY = 'app_layout_monochrome';

export function readStoredMonochrome(): boolean {
	try {
		return localStorage.getItem(MONOCHROME_KEY) === '1';
	} catch {
		return false;
	}
}

export function persistMonochrome(value: boolean) {
	try {
		localStorage.setItem(MONOCHROME_KEY, value ? '1' : '0');
	} catch {
		/* ignore */
	}
}
