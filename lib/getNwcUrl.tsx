export  function getNwcUrl() {
  const nwcUrl = process.env.EXPO_PUBLIC_NWC_URL;
  if (!nwcUrl) {
    throw new Error("NWC URL is not defined in environment variables.");
  }
  return nwcUrl;
}
