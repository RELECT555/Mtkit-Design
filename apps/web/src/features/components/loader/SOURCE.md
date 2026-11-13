# Shader Loader

Adapted from the Loader component supplied by the user and the author's public registry:

- Author: asanshay
- Component: https://ds.asanshay.com/loader
- Registry: https://ds.asanshay.com/r/loader.json
- Community listing: https://21st.dev/@asanshay/components/loader
- Retrieved: 2026-11-13

The GLSL vertex, plain, blur and dither shaders are retained from the registry. `shaders/utils.ts` retains its shared GLSL constants and shape functions; CSS color resolution is handled in `Loader.tsx`.

The local renderer adds visibility suspension, reduced-motion support, pause, bounded backing resolution, context recovery and GPU cleanup. It renders the shaders' premultiplied output without applying alpha twice. The React wrapper resolves colors within the component's theme scope and supplies an accessible static fallback. The demo uses `@mtkit/ui`; the exported TSX depends only on React.

The fetched registry does not include a license field or license text. No license is inferred or relabeled here. Source attribution is retained in the downloadable component.
