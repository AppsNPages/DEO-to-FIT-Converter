# DEO Lab

A local website and batch converter for reading ErgoRacer DEO files and exporting them as FIT cycling activities. All data stays local. There are no uploads or cloud services.

## Requirements and installation

Node.js 22 or later with npm. From the repository root:

```sh
npm ci
npm run build
npm test
```

The Garmin FIT SDK and esbuild versions are pinned in `package-lock.json`. `npm run build` generates the locally bundled website, the standalone HTML version that requires no server, and the standalone conversion script.

## Batch conversion

```sh
npm run convert -- "/path/to/DEO-files" "/path/to/FIT-output"
```

Alternatively, after building, with no additional npm dependencies required at runtime:

```sh
node convert-deo-to-fit.mjs "/path/to/DEO-files" "/path/to/FIT-output"
```

- Subdirectories are processed recursively and preserved in the output. Symbolic links are not followed.
- The output must be a different directory. If it is inside the input directory, it is excluded from scanning.
- Existing FIT files are skipped, never overwritten. Original DEO files remain unchanged.
- An error in one file does not stop processing the remaining files. A JSON report records results and errors.
- Every generated file is checked for FIT integrity. Files are first written to temporary files, then published using a hardlink. On filesystems without hardlink support (including some external drives and network shares), an exclusive copy is used instead. Existing destinations are never overwritten. The copy fallback is not atomic; an interrupted process or disconnected drive may leave a partial destination file that must be removed before retrying.
- Exit codes: `0` success/skipped, `1` file errors, `2` invocation or setup errors.

Filenames must follow the pattern `YYYYMMDD_HHMMSS_NAME.DEO`. The timestamp is interpreted in the computer's current time zone, using the daylight-saving or standard-time offset applicable to the ride date. Nonexistent local times during the transition to daylight saving are rejected; for a local time that occurs twice during the autumn transition, JavaScript uses the earlier occurrence.

## Website

```sh
npm start
```

Open <http://127.0.0.1:8765/>. If the port is already in use, run `PORT=8766 npm start` (macOS/Linux).

Alternatively, open `web/standalone.html` directly in a browser after building. The other files in `web/` include the evidence page. The interface supports file imports, measurement charts, section selection, smoothing, raw data, and CSV and FIT exports. Loaded data stays in memory only until the page is reloaded.

## Supported format and FIT mapping

The reader supports the investigated DEO record structure with observed header values `0` and `32`, 40-byte measurement records, and 430-/450-byte trailers. The meaning of this header field is not fully established; it does not indicate whether heart-rate data is present. Unknown variants are rejected. The parser reads time, distance, power, cadence, altitude, speed, temperature, heart rate, pauses, and interval numbers.

FIT files contain a cycling activity with one session and one lap. Internal pauses are represented as timer stop/start events. The final trailing pause value is outside the activity. In the website, pauses can be excluded when exporting. Selected sections start at zero distance and retain their time offset from the beginning of the ride. One final recording interval is included in the activity duration.

No GPS coordinates, interval laps, or estimated training stress values are generated. Integer FIT fields are rounded. The complete conventions and static analysis findings are documented in `web/evidence.html` and `web/native-evidence.txt`.

## Repository structure

```text
src/                  FIT export and batch CLI
web/                  Website, DEO parser, and evidence page
scripts/serve.mjs     Local HTTP server
build-local.mjs       Build the website and standalone HTML file
build-batch.mjs       Build the standalone batch script
test/                 Self-contained tests using synthetic data
test/corpus/          Additional tests for the original demo corpus
licenses/             License text for the Garmin dependency
package*.json         Dependencies, commands, and pinned versions
```

`npm test` works without proprietary sample files. The additional tests run with `npm run test:corpus` require the original 34 DEO files under `DATA/`, which are not included in this repository. Run `npm run build` first.

## Third-party components and publication

The official Garmin FIT SDK is installed by `npm ci`; its license text is included in `licenses/Garmin-FIT-SDK.txt`. Esbuild is used only for building. Generated files containing the embedded SDK and `node_modules` are not intended to be committed to Git. No additional open-source license is specified here for this project's own code.

`.gitignore` excludes the original executable, `DATA/`, local analysis artifacts, exported files, Sites metadata, and the previous working copy in `deo-viewer/`. These local files are not deleted. All project files required for installation, building, testing, and use are located in the repository root or the subdirectories listed above. This preparation does not publish or push anything.
