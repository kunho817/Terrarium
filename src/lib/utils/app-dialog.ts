function ensureDocument(): Document | null {
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		return null;
	}
	return document;
}

function createBaseOverlay(doc: Document) {
	const overlay = doc.createElement('div');
	overlay.style.position = 'fixed';
	overlay.style.inset = '0';
	overlay.style.zIndex = '9999';
	overlay.style.display = 'flex';
	overlay.style.alignItems = 'center';
	overlay.style.justifyContent = 'center';
	overlay.style.background = 'rgba(0, 0, 0, 0.55)';
	overlay.style.padding = '16px';

	const panel = doc.createElement('div');
	panel.style.width = 'min(100%, 420px)';
	panel.style.borderRadius = '8px';
	panel.style.border = '1px solid rgba(255,255,255,0.12)';
	panel.style.background = '#1e1e2e';
	panel.style.color = '#cdd6f4';
	panel.style.boxShadow = '0 20px 50px rgba(0,0,0,0.35)';
	panel.style.padding = '16px';
	panel.style.display = 'flex';
	panel.style.flexDirection = 'column';
	panel.style.gap = '12px';

	overlay.appendChild(panel);
	return { overlay, panel };
}

function createMessageElement(doc: Document, message: string) {
	const text = doc.createElement('p');
	text.textContent = message;
	text.style.margin = '0';
	text.style.fontSize = '14px';
	text.style.lineHeight = '1.5';
	text.style.whiteSpace = 'pre-wrap';
	return text;
}

function createButtonRow(doc: Document) {
	const actions = doc.createElement('div');
	actions.style.display = 'flex';
	actions.style.justifyContent = 'flex-end';
	actions.style.gap = '8px';
	return actions;
}

function createButton(
	doc: Document,
	label: string,
	variant: 'primary' | 'secondary',
	onClick: () => void,
) {
	const button = doc.createElement('button');
	button.type = 'button';
	button.textContent = label;
	button.onclick = onClick;
	button.style.borderRadius = '6px';
	button.style.padding = '8px 12px';
	button.style.fontSize = '13px';
	button.style.cursor = 'pointer';
	button.style.border = variant === 'primary'
		? '1px solid rgba(203, 166, 247, 0.35)'
		: '1px solid rgba(255,255,255,0.12)';
	button.style.background = variant === 'primary' ? '#cba6f7' : '#313244';
	button.style.color = variant === 'primary' ? '#11111b' : '#cdd6f4';
	return button;
}

function mountModal<T>(
	render: (
		doc: Document,
		resolve: (value: T) => void,
		reject: (error: unknown) => void,
	) => HTMLElement,
): Promise<T> {
	const doc = ensureDocument();
	if (!doc) {
		return Promise.reject(new Error('Dialog is unavailable outside the browser.'));
	}

	return new Promise<T>((resolve, reject) => {
		const root = render(doc, resolve, reject);
		doc.body.appendChild(root);
	});
}

export async function showAlertDialog(message: string): Promise<void> {
	return mountModal<void>((doc, resolve) => {
		const { overlay, panel } = createBaseOverlay(doc);
		const keyHandler = (event: KeyboardEvent) => {
			if (event.key === 'Escape' || event.key === 'Enter') {
				event.preventDefault();
				close();
			}
		};
		const cleanup = () => {
			doc.removeEventListener('keydown', keyHandler);
			overlay.remove();
		};
		const close = () => {
			cleanup();
			resolve();
		};

		panel.appendChild(createMessageElement(doc, message));

		const actions = createButtonRow(doc);
		actions.appendChild(createButton(doc, 'OK', 'primary', close));
		panel.appendChild(actions);

		overlay.onclick = (event) => {
			if (event.target === overlay) {
				close();
			}
		};
		doc.addEventListener('keydown', keyHandler);

		return overlay;
	});
}

export async function showConfirmDialog(message: string): Promise<boolean> {
	return mountModal<boolean>((doc, resolve) => {
		const { overlay, panel } = createBaseOverlay(doc);
		let closed = false;
		const keyHandler = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				finish(false);
			}
		};

		const cleanup = () => {
			if (closed) return;
			closed = true;
			doc.removeEventListener('keydown', keyHandler);
			overlay.remove();
		};
		const finish = (value: boolean) => {
			cleanup();
			resolve(value);
		};

		panel.appendChild(createMessageElement(doc, message));

		const actions = createButtonRow(doc);
		actions.appendChild(createButton(doc, 'Cancel', 'secondary', () => finish(false)));
		actions.appendChild(createButton(doc, 'Confirm', 'primary', () => finish(true)));
		panel.appendChild(actions);

		overlay.onclick = (event) => {
			if (event.target === overlay) {
				finish(false);
			}
		};
		doc.addEventListener('keydown', keyHandler);

		return overlay;
	});
}
