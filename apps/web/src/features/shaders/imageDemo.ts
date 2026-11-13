import imageUrl from "./image-demo.jpg?no-inline";

// Bundled locally so previews work without a third-party image request.
export const imageDemo = {
  url: imageUrl,
  author: "Maxim Yuryshev",
  source: "https://unsplash.com/photos/orange-flowers-illuminated-by-vibrant-blue-and-orange-light-oFJ8pUVR8jw/",
} as const;
