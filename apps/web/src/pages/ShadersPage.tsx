import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { Layout } from "../app/Layout";
import { ShaderGallery } from "../features/shaders/ShaderGallery";
import { ShaderStudio } from "../features/shaders/ShaderStudio";
import { shaderPresets, type ShaderPreset } from "../features/shaders/presets";

const motionQuery = "(prefers-reduced-motion: reduce)";

function selectedPreset() {
  const id = new URLSearchParams(location.search).get("shader");
  return shaderPresets.find((preset) => preset.id === id);
}

function isPlainClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function ShadersPage() {
  const [selected, setSelected] = useState(selectedPreset);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ShaderPreset["group"] | "">("");
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia(motionQuery).matches);
  const [playingOverride, setPlayingOverride] = useState<boolean>();
  const [galleryPaused, setGalleryPaused] = useState(false);
  const [animateDetail, setAnimateDetail] = useState(false);
  const galleryTitle = useRef<HTMLHeadingElement>(null);
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const previous = useRef(selected);

  useEffect(() => {
    const sync = () => {
      setAnimateDetail(false);
      setSelected(selectedPreset());
    };
    const motion = matchMedia(motionQuery);
    const syncMotion = ({ matches }: MediaQueryListEvent) => {
      setReducedMotion(matches);
      if (matches) setPlayingOverride((current) => current === true ? undefined : current);
    };
    window.addEventListener("popstate", sync);
    motion.addEventListener("change", syncMotion);
    return () => {
      window.removeEventListener("popstate", sync);
      motion.removeEventListener("change", syncMotion);
    };
  }, []);

  useLayoutEffect(() => {
    document.title = selected ? `${selected.name} · MTKit Design` : "Шейдеры · MTKit Design";
    if (previous.current === selected) return;

    if (selected) {
      detailTitle.current?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      const card = previous.current && document.getElementById(`shader-card-${previous.current.id}`);
      (card || galleryTitle.current)?.focus();
    }
    previous.current = selected;
  }, [selected]);

  function openShader(event: MouseEvent<HTMLAnchorElement>, preset: ShaderPreset) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    history.pushState({ shaderFromGallery: true }, "", event.currentTarget.href);
    setAnimateDetail(event.detail > 0);
    setSelected(preset);
  }

  function openGallery(event: MouseEvent<HTMLAnchorElement>) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    if (history.state?.shaderFromGallery === true) {
      history.back();
      return;
    }
    history.replaceState(null, "", event.currentTarget.href);
    setSelected(undefined);
  }

  return (
    <Layout page="shaders">
      <div className={`page-container shader-library${selected ? "" : " gallery-container"}`} data-animate-detail={selected && animateDetail ? "" : undefined}>
        {selected ? (
          <ShaderStudio key={selected.id} preset={selected} playing={playingOverride ?? !reducedMotion} onPlayingChange={setPlayingOverride} onBack={openGallery} headingRef={detailTitle} />
        ) : (
          <ShaderGallery query={query} category={category} onQueryChange={setQuery} onCategoryChange={setCategory} playing={!galleryPaused && !reducedMotion} onTogglePlayback={reducedMotion ? undefined : () => setGalleryPaused((paused) => !paused)} onOpen={openShader} headingRef={galleryTitle} />
        )}
      </div>
    </Layout>
  );
}
