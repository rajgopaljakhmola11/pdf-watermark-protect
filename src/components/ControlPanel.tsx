import type { ChangeEvent } from "react";
import { sniffImage } from "../lib/magicBytes";
import { parsePageRange } from "../lib/pageRange";
import { passwordStrength } from "../lib/password";
import { BAD_IMAGE, humaniseError } from "../lib/errors";
import type {
  AesBits,
  FontFamily,
  FontStyle,
  LayerOrder,
  PageTarget,
  PlacementSettings,
  PositionPreset,
  WatermarkSettings,
} from "../types";

const PRESETS: { id: PositionPreset; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-centre", label: "Top centre" },
  { id: "top-right", label: "Top right" },
  { id: "middle-left", label: "Middle left" },
  { id: "centre", label: "Centre" },
  { id: "middle-right", label: "Middle right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-centre", label: "Bottom centre" },
  { id: "bottom-right", label: "Bottom right" },
];

interface ControlPanelProps {
  enabled: boolean;
  watermark: WatermarkSettings;
  onWatermark: (next: WatermarkSettings) => void;
  placement: PlacementSettings;
  onPlacement: (next: PlacementSettings) => void;
  pageTarget: PageTarget;
  onPageTarget: (next: PageTarget) => void;
  customRange: string;
  onCustomRange: (next: string) => void;
  pageCount: number;
  userPassword: string;
  onUserPassword: (v: string) => void;
  confirmPassword: string;
  onConfirmPassword: (v: string) => void;
  ownerPassword: string;
  onOwnerPassword: (v: string) => void;
  showUser: boolean;
  showOwner: boolean;
  onToggleUser: () => void;
  onToggleOwner: () => void;
  aesBits: AesBits;
  onAesBits: (v: AesBits) => void;
  allowPrinting: boolean;
  onAllowPrinting: (v: boolean) => void;
  allowCopying: boolean;
  onAllowCopying: (v: boolean) => void;
  allowEditing: boolean;
  onAllowEditing: (v: boolean) => void;
  rangeError: string | null;
}

export function ControlPanel(props: ControlPanelProps) {
  const disabled = !props.enabled;
  const wm = props.watermark;
  const mismatch =
    props.confirmPassword.length > 0 &&
    props.confirmPassword !== props.userPassword;
  const strength = passwordStrength(props.userPassword);
  const parsed =
    props.pageTarget === "custom"
      ? parsePageRange(props.customRange, props.pageCount)
      : { ok: true as const, pages: [] };

  async function onImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const imageType = sniffImage(bytes);
      const dims = await readImageSize(bytes, imageType);
      props.onWatermark({
        kind: "image",
        imageBytes: bytes,
        imageType,
        naturalWidth: dims.width,
        naturalHeight: dims.height,
        scalePercent: wm.kind === "image" ? wm.scalePercent : 50,
        opacity: wm.opacity,
        rotation: wm.rotation,
      });
    } catch (error) {
      window.alert(humaniseError(error instanceof Error ? error : new Error(BAD_IMAGE)));
    }
  }

  return (
    <div className={"space-y-6 " + (disabled ? "pointer-events-none opacity-50" : "")}>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Watermark</legend>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="wmkind"
              checked={wm.kind === "text"}
              onChange={() =>
                props.onWatermark({
                  kind: "text",
                  text: "CONFIDENTIAL",
                  fontFamily: "helvetica",
                  fontStyle: "normal",
                  fontSize: 36,
                  hexColour: "#666666",
                  opacity: 40,
                  rotation: -30,
                })
              }
            />
            Text
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="wmkind"
              checked={wm.kind === "image"}
              onChange={() =>
                props.onWatermark({
                  kind: "image",
                  imageBytes: new Uint8Array(),
                  imageType: "image/png",
                  naturalWidth: 1,
                  naturalHeight: 1,
                  scalePercent: 50,
                  opacity: 40,
                  rotation: -30,
                })
              }
            />
            Image
          </label>
        </div>

        {wm.kind === "text" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 text-sm">
              Text
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                value={wm.text}
                onChange={(e) => props.onWatermark({ ...wm, text: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Font
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                value={wm.fontFamily}
                onChange={(e) =>
                  props.onWatermark({ ...wm, fontFamily: e.target.value as FontFamily })
                }
              >
                <option value="helvetica">Helvetica</option>
                <option value="times">Times Roman</option>
                <option value="courier">Courier</option>
              </select>
            </label>
            <label className="text-sm">
              Style
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                value={wm.fontStyle}
                onChange={(e) =>
                  props.onWatermark({ ...wm, fontStyle: e.target.value as FontStyle })
                }
              >
                <option value="normal">Regular</option>
                <option value="bold">Bold</option>
                <option value="italic">Italic</option>
                <option value="boldItalic">Bold italic</option>
              </select>
            </label>
            <label className="text-sm">
              Size
              <input
                type="number"
                min={6}
                max={200}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                value={wm.fontSize}
                onChange={(e) =>
                  props.onWatermark({ ...wm, fontSize: Number(e.target.value) || 12 })
                }
              />
            </label>
            <label className="text-sm">
              Colour
              <input
                type="color"
                className="mt-1 h-9 w-full rounded-md border border-zinc-300 dark:border-zinc-600"
                value={wm.hexColour}
                onChange={(e) => props.onWatermark({ ...wm, hexColour: e.target.value })}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm">
              PNG or JPG
              <input
                type="file"
                accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                className="mt-1 block w-full text-sm"
                onChange={(e) => void onImage(e)}
              />
            </label>
            <label className="text-sm">
              Scale ({wm.kind === "image" ? wm.scalePercent : 50}%)
              <input
                type="range"
                min={5}
                max={200}
                value={wm.kind === "image" ? wm.scalePercent : 50}
                onChange={(e) =>
                  wm.kind === "image" &&
                  props.onWatermark({ ...wm, scalePercent: Number(e.target.value) })
                }
                className="mt-1 w-full"
              />
            </label>
          </div>
        )}

        <label className="block text-sm">
          Opacity ({wm.opacity}%)
          <input
            type="range"
            min={10}
            max={100}
            value={wm.opacity}
            onChange={(e) => props.onWatermark({ ...wm, opacity: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
        <label className="block text-sm">
          Rotation ({wm.rotation}°)
          <input
            type="range"
            min={-90}
            max={90}
            value={wm.rotation}
            onChange={(e) => props.onWatermark({ ...wm, rotation: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Position</legend>
        <div className="grid grid-cols-3 gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={
                "rounded-md border px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 " +
                (props.placement.preset === p.id
                  ? "border-sky-500 bg-sky-50 dark:bg-sky-950"
                  : "border-zinc-300 dark:border-zinc-600")
              }
              onClick={() => props.onPlacement({ ...props.placement, preset: p.id })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={props.placement.tiled}
            onChange={(e) =>
              props.onPlacement({ ...props.placement, tiled: e.target.checked })
            }
          />
          Tile across the page
        </label>
        {props.placement.tiled && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Rows
              <input
                type="number"
                min={1}
                max={20}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                value={props.placement.rows}
                onChange={(e) =>
                  props.onPlacement({
                    ...props.placement,
                    rows: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </label>
            <label className="text-sm">
              Columns
              <input
                type="number"
                min={1}
                max={20}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                value={props.placement.columns}
                onChange={(e) =>
                  props.onPlacement({
                    ...props.placement,
                    columns: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </label>
          </div>
        )}
        <fieldset className="space-y-1">
          <legend className="text-sm">Layer</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="layer"
              checked={props.placement.layer === "on-top"}
              onChange={() => props.onPlacement({ ...props.placement, layer: "on-top" as LayerOrder })}
            />
            On top of content
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="layer"
              checked={props.placement.layer === "behind"}
              onChange={() => props.onPlacement({ ...props.placement, layer: "behind" as LayerOrder })}
            />
            Behind content
          </label>
        </fieldset>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Pages</legend>
        {(["all", "first", "custom"] as PageTarget[]).map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="pages"
              checked={props.pageTarget === t}
              onChange={() => props.onPageTarget(t)}
            />
            {t === "all" ? "All pages" : t === "first" ? "First page only" : "Custom range"}
          </label>
        ))}
        {props.pageTarget === "custom" && (
          <label className="block text-sm">
            Range
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="1-3, 5, 8-10"
              value={props.customRange}
              onChange={(e) => props.onCustomRange(e.target.value)}
              aria-invalid={parsed.ok ? undefined : true}
            />
            {!parsed.ok && (
              <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
                {parsed.error}
              </span>
            )}
          </label>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Password and encryption</legend>
        <label className="block text-sm">
          User password (required to open)
          <span className="mt-1 flex gap-2">
            <input
              type={props.showUser ? "text" : "password"}
              autoComplete="new-password"
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              value={props.userPassword}
              onChange={(e) => props.onUserPassword(e.target.value)}
            />
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-600"
              onClick={props.onToggleUser}
            >
              {props.showUser ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        {props.userPassword.length > 0 && (
          <p className="text-xs text-zinc-500">
            Strength: {strength.label} (informational only)
          </p>
        )}
        <label className="block text-sm">
          Confirm user password
          <input
            type={props.showUser ? "text" : "password"}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
            value={props.confirmPassword}
            onChange={(e) => props.onConfirmPassword(e.target.value)}
          />
          {mismatch && (
            <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
              Passwords do not match.
            </span>
          )}
        </label>
        <label className="block text-sm">
          Owner password (optional)
          <span className="mt-1 flex gap-2">
            <input
              type={props.showOwner ? "text" : "password"}
              autoComplete="new-password"
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              value={props.ownerPassword}
              onChange={(e) => props.onOwnerPassword(e.target.value)}
            />
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-600"
              onClick={props.onToggleOwner}
            >
              {props.showOwner ? "Hide" : "Show"}
            </button>
          </span>
          <span className="mt-1 block text-xs text-zinc-500">
            Leave blank to generate a strong owner password so permission flags can be enforced.
          </span>
        </label>
        <label className="text-sm">
          AES key length
          <select
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
            value={props.aesBits}
            onChange={(e) => props.onAesBits(Number(e.target.value) as AesBits)}
          >
            <option value={256}>AES-256</option>
            <option value={128}>AES-128</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={props.allowPrinting}
            onChange={(e) => props.onAllowPrinting(e.target.checked)}
          />
          Allow printing
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={props.allowCopying}
            onChange={(e) => props.onAllowCopying(e.target.checked)}
          />
          Allow copying
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={props.allowEditing}
            onChange={(e) => props.onAllowEditing(e.target.checked)}
          />
          Allow editing and annotation
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Accessibility (screen readers) is always enabled so assistive technology can read the document after it is unlocked.
        </p>
      </fieldset>
    </div>
  );
}

function readImageSize(
  bytes: Uint8Array,
  type: "image/png" | "image/jpeg",
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes.slice().buffer], { type });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(BAD_IMAGE));
    };
    img.src = url;
  });
}
