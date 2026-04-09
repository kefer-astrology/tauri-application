import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const appsDir = path.join(rootDir, "apps");
const generatedDataDir = path.join(rootDir, "docs", "data", "generated");
const generatedAppsDir = path.join(rootDir, "docs", "static", "apps");

async function readJson(filePath) {
	const raw = await readFile(filePath, "utf8");
	return JSON.parse(raw);
}

async function pathExists(targetPath) {
	try {
		await readFile(targetPath);
		return true;
	} catch {
		return false;
	}
}

async function dirExists(targetPath) {
	try {
		const entries = await readdir(targetPath);
		return Array.isArray(entries);
	} catch {
		return false;
	}
}

async function collectFrontends() {
	const entries = await readdir(appsDir, { withFileTypes: true });
	const manifests = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		const appDir = path.join(appsDir, entry.name);
		const packageJsonPath = path.join(appDir, "package.json");
		const packageJsonExists = await pathExists(packageJsonPath);

		if (!packageJsonExists) {
			continue;
		}

		const pkg = await readJson(packageJsonPath);
		const hasBuildScript = typeof pkg.scripts?.build === "string";
		const distDir = path.join(appDir, "dist");
		const hasDistDir = await dirExists(distDir);

		if (!hasBuildScript || !hasDistDir) {
			continue;
		}

		manifests.push({
			id: entry.name,
			name: pkg.name ?? entry.name,
			title: pkg.description ?? pkg.name ?? entry.name,
			source: `apps/${entry.name}`,
			output: `apps/${entry.name}/`,
		});

		await cp(distDir, path.join(generatedAppsDir, entry.name), {
			recursive: true,
			force: true,
		});
	}

	return manifests.sort((left, right) => left.id.localeCompare(right.id));
}

async function main() {
	await rm(generatedAppsDir, { recursive: true, force: true });
	await rm(generatedDataDir, { recursive: true, force: true });
	await mkdir(generatedAppsDir, { recursive: true });
	await mkdir(generatedDataDir, { recursive: true });

	const frontends = await collectFrontends();

	await writeFile(
		path.join(generatedDataDir, "frontends.json"),
		JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				frontends,
			},
			null,
			2,
		),
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
