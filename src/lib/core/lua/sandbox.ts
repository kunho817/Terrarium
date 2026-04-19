const SANDBOX_SCRIPT = `
io = nil
os.execute = nil
os.getenv = nil
os.exit = nil
os.remove = nil
os.rename = nil
os.tmpname = nil
debug = nil
require = nil
dofile = nil
loadfile = nil
module = nil
package = nil
`;

export async function applySandbox(engine: { doString: (code: string) => Promise<unknown> }): Promise<void> {
	await engine.doString(SANDBOX_SCRIPT);
}
