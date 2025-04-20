const BASE_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic';
const accessToken = 'pk.eyJ1IjoicHJha2hhcnJtIiwiYSI6ImNtOWR5aGRhMjBpZ2wyaXI3ZDRiazJpa3UifQ.1_XXxtXUZD_YH67ADDy5Mw';

export async function getDirection(from, to) {
  const coordinates = `${from[0]},${from[1]};${to[0]},${to[1]}`;

  const url = `${BASE_URL}/${coordinates}?alternatives=true&geometries=geojson&language=en&overview=full&steps=true&annotations=congestion&access_token=${accessToken}`;

  try {
    const response = await fetch(url);
    const json = await response.json();
 
    return json;
  } catch (error) {
    console.error("Error fetching directions:", error);
    return null;
  }
}


export async function searchLocation(searchQuery) {
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${searchQuery}&proximity=ip&access_token=${accessToken}`;
  const response = await fetch(url);
  const json = await response.json();

  // Filter out usable data
  const suggestions = json.features.map((feature) => ({
    name: feature.properties.name_preferred || feature.properties.name,
    address: feature.properties.full_address,
    coordinates: feature.geometry.coordinates,
  }));

  return suggestions;
}
