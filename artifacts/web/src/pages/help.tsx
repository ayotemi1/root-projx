import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, Globe, LayoutGrid, MapPin, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { VisitorHeading } from "@/components/visitor/VisitorHeading";
import { VisitorFilterBar } from "@/components/visitor/VisitorFilterBar";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";
import type { Resource } from "@/lib/api";

const CATEGORIES = [
  "All Categories",
  "Youth Empowerment",
  "Maternal Health",
  "Environment",
  "Diaspora Support",
  "Education",
  "Mental Health",
  "Arts & Culture",
  "Food Security & Nutrition",
  "Housing & Homelessness",
  "Women & Girls",
  "Elderly Care",
  "Disability & Accessibility",
  "Community Development",
  "Conservation & Wildlife",
  "Sport & Recreation",
  "Economic Empowerment & Livelihoods",
  "Disaster Relief",
  "Religious & Spiritual Community",
  "Children & Family",
  "Health & Wellbeing",
  "Human Rights & Justice",
  "Animal Welfare",
  "Digital Inclusion",
  "Drug & Alcohol Recovery",
  "Refugee & Migrant Support",
  "Prison & Rehabilitation",
  "Clean Water & Sanitation",
  "Agriculture & Farming",
  "Housing",
  "Legal",
  "Health",
];

const COUNTRIES = [
  { label: "All Countries", value: "All Countries" },
  { label: "Afghanistan 🇦🇫", value: "Afghanistan" },
  { label: "Albania 🇦🇱", value: "Albania" },
  { label: "Algeria 🇩🇿", value: "Algeria" },
  { label: "Andorra 🇦🇩", value: "Andorra" },
  { label: "Angola 🇦🇴", value: "Angola" },
  { label: "Antigua and Barbuda 🇦🇬", value: "Antigua and Barbuda" },
  { label: "Argentina 🇦🇷", value: "Argentina" },
  { label: "Armenia 🇦🇲", value: "Armenia" },
  { label: "Australia 🇦🇺", value: "Australia" },
  { label: "Austria 🇦🇹", value: "Austria" },
  { label: "Azerbaijan 🇦🇿", value: "Azerbaijan" },
  { label: "Bahamas 🇧🇸", value: "Bahamas" },
  { label: "Bahrain 🇧🇭", value: "Bahrain" },
  { label: "Bangladesh 🇧🇩", value: "Bangladesh" },
  { label: "Barbados 🇧🇧", value: "Barbados" },
  { label: "Belarus 🇧🇾", value: "Belarus" },
  { label: "Belgium 🇧🇪", value: "Belgium" },
  { label: "Belize 🇧🇿", value: "Belize" },
  { label: "Benin 🇧🇯", value: "Benin" },
  { label: "Bhutan 🇧🇹", value: "Bhutan" },
  { label: "Bolivia 🇧🇴", value: "Bolivia" },
  { label: "Bosnia and Herzegovina 🇧🇦", value: "Bosnia and Herzegovina" },
  { label: "Botswana 🇧🇼", value: "Botswana" },
  { label: "Brazil 🇧🇷", value: "Brazil" },
  { label: "Brunei 🇧🇳", value: "Brunei" },
  { label: "Bulgaria 🇧🇬", value: "Bulgaria" },
  { label: "Burkina Faso 🇧🇫", value: "Burkina Faso" },
  { label: "Burundi 🇧🇮", value: "Burundi" },
  { label: "Cabo Verde 🇨🇻", value: "Cabo Verde" },
  { label: "Cambodia 🇰🇭", value: "Cambodia" },
  { label: "Cameroon 🇨🇲", value: "Cameroon" },
  { label: "Canada 🇨🇦", value: "Canada" },
  { label: "Central African Republic 🇨🇫", value: "Central African Republic" },
  { label: "Chad 🇹🇩", value: "Chad" },
  { label: "Chile 🇨🇱", value: "Chile" },
  { label: "China 🇨🇳", value: "China" },
  { label: "Colombia 🇨🇴", value: "Colombia" },
  { label: "Comoros 🇰🇲", value: "Comoros" },
  { label: "Congo (Brazzaville) 🇨🇬", value: "Congo (Brazzaville)" },
  { label: "Congo (Kinshasa) 🇨🇩", value: "Congo (Kinshasa)" },
  { label: "Costa Rica 🇨🇷", value: "Costa Rica" },
  { label: "Côte d'Ivoire 🇨🇮", value: "Côte d'Ivoire" },
  { label: "Croatia 🇭🇷", value: "Croatia" },
  { label: "Cuba 🇨🇺", value: "Cuba" },
  { label: "Cyprus 🇨🇾", value: "Cyprus" },
  { label: "Czech Republic 🇨🇿", value: "Czech Republic" },
  { label: "Denmark 🇩🇰", value: "Denmark" },
  { label: "Djibouti 🇩🇯", value: "Djibouti" },
  { label: "Dominica 🇩🇲", value: "Dominica" },
  { label: "Dominican Republic 🇩🇴", value: "Dominican Republic" },
  { label: "Ecuador 🇪🇨", value: "Ecuador" },
  { label: "Egypt 🇪🇬", value: "Egypt" },
  { label: "El Salvador 🇸🇻", value: "El Salvador" },
  { label: "Equatorial Guinea 🇬🇶", value: "Equatorial Guinea" },
  { label: "Eritrea 🇪🇷", value: "Eritrea" },
  { label: "Estonia 🇪🇪", value: "Estonia" },
  { label: "Eswatini 🇸🇿", value: "Eswatini" },
  { label: "Ethiopia 🇪🇹", value: "Ethiopia" },
  { label: "Fiji 🇫🇯", value: "Fiji" },
  { label: "Finland 🇫🇮", value: "Finland" },
  { label: "France 🇫🇷", value: "France" },
  { label: "Gabon 🇬🇦", value: "Gabon" },
  { label: "Gambia 🇬🇲", value: "Gambia" },
  { label: "Georgia 🇬🇪", value: "Georgia" },
  { label: "Germany 🇩🇪", value: "Germany" },
  { label: "Ghana 🇬🇭", value: "Ghana" },
  { label: "Greece 🇬🇷", value: "Greece" },
  { label: "Grenada 🇬🇩", value: "Grenada" },
  { label: "Guatemala 🇬🇹", value: "Guatemala" },
  { label: "Guinea 🇬🇳", value: "Guinea" },
  { label: "Guinea-Bissau 🇬🇼", value: "Guinea-Bissau" },
  { label: "Guyana 🇬🇾", value: "Guyana" },
  { label: "Haiti 🇭🇹", value: "Haiti" },
  { label: "Honduras 🇭🇳", value: "Honduras" },
  { label: "Hungary 🇭🇺", value: "Hungary" },
  { label: "Iceland 🇮🇸", value: "Iceland" },
  { label: "India 🇮🇳", value: "India" },
  { label: "Indonesia 🇮🇩", value: "Indonesia" },
  { label: "Iran 🇮🇷", value: "Iran" },
  { label: "Iraq 🇮🇶", value: "Iraq" },
  { label: "Ireland 🇮🇪", value: "Ireland" },
  { label: "Israel 🇮🇱", value: "Israel" },
  { label: "Italy 🇮🇹", value: "Italy" },
  { label: "Jamaica 🇯🇲", value: "Jamaica" },
  { label: "Japan 🇯🇵", value: "Japan" },
  { label: "Jordan 🇯🇴", value: "Jordan" },
  { label: "Kazakhstan 🇰🇿", value: "Kazakhstan" },
  { label: "Kenya 🇰🇪", value: "Kenya" },
  { label: "Kiribati 🇰🇮", value: "Kiribati" },
  { label: "Kuwait 🇰🇼", value: "Kuwait" },
  { label: "Kyrgyzstan 🇰🇬", value: "Kyrgyzstan" },
  { label: "Laos 🇱🇦", value: "Laos" },
  { label: "Latvia 🇱🇻", value: "Latvia" },
  { label: "Lebanon 🇱🇧", value: "Lebanon" },
  { label: "Lesotho 🇱🇸", value: "Lesotho" },
  { label: "Liberia 🇱🇷", value: "Liberia" },
  { label: "Libya 🇱🇾", value: "Libya" },
  { label: "Liechtenstein 🇱🇮", value: "Liechtenstein" },
  { label: "Lithuania 🇱🇹", value: "Lithuania" },
  { label: "Luxembourg 🇱🇺", value: "Luxembourg" },
  { label: "Madagascar 🇲🇬", value: "Madagascar" },
  { label: "Malawi 🇲🇼", value: "Malawi" },
  { label: "Malaysia 🇲🇾", value: "Malaysia" },
  { label: "Maldives 🇲🇻", value: "Maldives" },
  { label: "Mali 🇲🇱", value: "Mali" },
  { label: "Malta 🇲🇹", value: "Malta" },
  { label: "Marshall Islands 🇲🇭", value: "Marshall Islands" },
  { label: "Mauritania 🇲🇷", value: "Mauritania" },
  { label: "Mauritius 🇲🇺", value: "Mauritius" },
  { label: "Mexico 🇲🇽", value: "Mexico" },
  { label: "Micronesia 🇫🇲", value: "Micronesia" },
  { label: "Moldova 🇲🇩", value: "Moldova" },
  { label: "Monaco 🇲🇨", value: "Monaco" },
  { label: "Mongolia 🇲🇳", value: "Mongolia" },
  { label: "Montenegro 🇲🇪", value: "Montenegro" },
  { label: "Morocco 🇲🇦", value: "Morocco" },
  { label: "Mozambique 🇲🇿", value: "Mozambique" },
  { label: "Myanmar 🇲🇲", value: "Myanmar" },
  { label: "Namibia 🇳🇦", value: "Namibia" },
  { label: "Nauru 🇳🇷", value: "Nauru" },
  { label: "Nepal 🇳🇵", value: "Nepal" },
  { label: "Netherlands 🇳🇱", value: "Netherlands" },
  { label: "New Zealand 🇳🇿", value: "New Zealand" },
  { label: "Nicaragua 🇳🇮", value: "Nicaragua" },
  { label: "Niger 🇳🇪", value: "Niger" },
  { label: "Nigeria 🇳🇬", value: "Nigeria" },
  { label: "North Korea 🇰🇵", value: "North Korea" },
  { label: "North Macedonia 🇲🇰", value: "North Macedonia" },
  { label: "Norway 🇳🇴", value: "Norway" },
  { label: "Oman 🇴🇲", value: "Oman" },
  { label: "Pakistan 🇵🇰", value: "Pakistan" },
  { label: "Palau 🇵🇼", value: "Palau" },
  { label: "Palestine 🇵🇸", value: "Palestine" },
  { label: "Panama 🇵🇦", value: "Panama" },
  { label: "Papua New Guinea 🇵🇬", value: "Papua New Guinea" },
  { label: "Paraguay 🇵🇾", value: "Paraguay" },
  { label: "Peru 🇵🇪", value: "Peru" },
  { label: "Philippines 🇵🇭", value: "Philippines" },
  { label: "Poland 🇵🇱", value: "Poland" },
  { label: "Portugal 🇵🇹", value: "Portugal" },
  { label: "Qatar 🇶🇦", value: "Qatar" },
  { label: "Romania 🇷🇴", value: "Romania" },
  { label: "Russia 🇷🇺", value: "Russia" },
  { label: "Rwanda 🇷🇼", value: "Rwanda" },
  { label: "Saint Kitts and Nevis 🇰🇳", value: "Saint Kitts and Nevis" },
  { label: "Saint Lucia 🇱🇨", value: "Saint Lucia" },
  { label: "Saint Vincent and the Grenadines 🇻🇨", value: "Saint Vincent and the Grenadines" },
  { label: "Samoa 🇼🇸", value: "Samoa" },
  { label: "San Marino 🇸🇲", value: "San Marino" },
  { label: "São Tomé and Príncipe 🇸🇹", value: "São Tomé and Príncipe" },
  { label: "Saudi Arabia 🇸🇦", value: "Saudi Arabia" },
  { label: "Senegal 🇸🇳", value: "Senegal" },
  { label: "Serbia 🇷🇸", value: "Serbia" },
  { label: "Seychelles 🇸🇨", value: "Seychelles" },
  { label: "Sierra Leone 🇸🇱", value: "Sierra Leone" },
  { label: "Singapore 🇸🇬", value: "Singapore" },
  { label: "Slovakia 🇸🇰", value: "Slovakia" },
  { label: "Slovenia 🇸🇮", value: "Slovenia" },
  { label: "Solomon Islands 🇸🇧", value: "Solomon Islands" },
  { label: "Somalia 🇸🇴", value: "Somalia" },
  { label: "South Africa 🇿🇦", value: "South Africa" },
  { label: "South Korea 🇰🇷", value: "South Korea" },
  { label: "South Sudan 🇸🇸", value: "South Sudan" },
  { label: "Spain 🇪🇸", value: "Spain" },
  { label: "Sri Lanka 🇱🇰", value: "Sri Lanka" },
  { label: "Sudan 🇸🇩", value: "Sudan" },
  { label: "Suriname 🇸🇷", value: "Suriname" },
  { label: "Sweden 🇸🇪", value: "Sweden" },
  { label: "Switzerland 🇨🇭", value: "Switzerland" },
  { label: "Syria 🇸🇾", value: "Syria" },
  { label: "Taiwan 🇹🇼", value: "Taiwan" },
  { label: "Tajikistan 🇹🇯", value: "Tajikistan" },
  { label: "Tanzania 🇹🇿", value: "Tanzania" },
  { label: "Thailand 🇹🇭", value: "Thailand" },
  { label: "Timor-Leste 🇹🇱", value: "Timor-Leste" },
  { label: "Togo 🇹🇬", value: "Togo" },
  { label: "Tonga 🇹🇴", value: "Tonga" },
  { label: "Trinidad and Tobago 🇹🇹", value: "Trinidad and Tobago" },
  { label: "Tunisia 🇹🇳", value: "Tunisia" },
  { label: "Turkey 🇹🇷", value: "Turkey" },
  { label: "Turkmenistan 🇹🇲", value: "Turkmenistan" },
  { label: "Tuvalu 🇹🇻", value: "Tuvalu" },
  { label: "Uganda 🇺🇬", value: "Uganda" },
  { label: "Ukraine 🇺🇦", value: "Ukraine" },
  { label: "United Arab Emirates 🇦🇪", value: "United Arab Emirates" },
  { label: "United Kingdom 🇬🇧", value: "United Kingdom" },
  { label: "United States 🇺🇸", value: "United States" },
  { label: "Uruguay 🇺🇾", value: "Uruguay" },
  { label: "Uzbekistan 🇺🇿", value: "Uzbekistan" },
  { label: "Vanuatu 🇻🇺", value: "Vanuatu" },
  { label: "Vatican City 🇻🇦", value: "Vatican City" },
  { label: "Venezuela 🇻🇪", value: "Venezuela" },
  { label: "Vietnam 🇻🇳", value: "Vietnam" },
  { label: "Yemen 🇾🇪", value: "Yemen" },
  { label: "Zambia 🇿🇲", value: "Zambia" },
  { label: "Zimbabwe 🇿🇼", value: "Zimbabwe" },
];

const COUNTRY_COORDS: Record<string, { center: [number, number]; zoom: number }> = {
  Afghanistan:               { center: [33.9391, 67.7100],  zoom: 6 },
  Albania:                   { center: [41.1533, 20.1683],  zoom: 7 },
  Algeria:                   { center: [28.0339, 1.6596],   zoom: 5 },
  Angola:                    { center: [-11.2027, 17.8739], zoom: 6 },
  Argentina:                 { center: [-38.4161, -63.6167],zoom: 4 },
  Australia:                 { center: [-25.2744, 133.7751],zoom: 4 },
  Bangladesh:                { center: [23.6850, 90.3563],  zoom: 7 },
  Barbados:                  { center: [13.1939, -59.5432], zoom: 10 },
  Belgium:                   { center: [50.5039, 4.4699],   zoom: 7 },
  Belize:                    { center: [17.1899, -88.4976], zoom: 7 },
  Bolivia:                   { center: [-16.2902, -63.5887],zoom: 6 },
  Brazil:                    { center: [-14.2350, -51.9253],zoom: 4 },
  Cambodia:                  { center: [12.5657, 104.9910], zoom: 7 },
  Cameroon:                  { center: [3.8480, 11.5021],   zoom: 6 },
  Canada:                    { center: [56.1304, -106.3468],zoom: 4 },
  Chile:                     { center: [-35.6751, -71.5430],zoom: 5 },
  China:                     { center: [35.8617, 104.1954], zoom: 4 },
  Colombia:                  { center: [4.5709, -74.2973],  zoom: 6 },
  Cuba:                      { center: [21.5218, -77.7812], zoom: 7 },
  "Dominican Republic":      { center: [18.7357, -70.1627], zoom: 8 },
  Ecuador:                   { center: [-1.8312, -78.1834], zoom: 7 },
  Egypt:                     { center: [26.8206, 30.8025],  zoom: 6 },
  Ethiopia:                  { center: [9.1450, 40.4897],   zoom: 6 },
  France:                    { center: [46.2276, 2.2137],   zoom: 6 },
  Germany:                   { center: [51.1657, 10.4515],  zoom: 6 },
  Ghana:                     { center: [7.9465, -1.0232],   zoom: 7 },
  Greece:                    { center: [39.0742, 21.8243],  zoom: 7 },
  Grenada:                   { center: [12.1165, -61.6790], zoom: 11 },
  Guatemala:                 { center: [15.7835, -90.2308], zoom: 7 },
  Guyana:                    { center: [4.8604, -58.9302],  zoom: 7 },
  Haiti:                     { center: [18.9712, -72.2852], zoom: 8 },
  Honduras:                  { center: [15.1999, -86.2419], zoom: 7 },
  India:                     { center: [20.5937, 78.9629],  zoom: 5 },
  Indonesia:                 { center: [-0.7893, 113.9213], zoom: 5 },
  Iran:                      { center: [32.4279, 53.6880],  zoom: 6 },
  Iraq:                      { center: [33.2232, 43.6793],  zoom: 6 },
  Ireland:                   { center: [53.1424, -7.6921],  zoom: 7 },
  Israel:                    { center: [31.0461, 34.8516],  zoom: 8 },
  Italy:                     { center: [41.8719, 12.5674],  zoom: 6 },
  Jamaica:                   { center: [18.1096, -77.2975], zoom: 8 },
  Japan:                     { center: [36.2048, 138.2529], zoom: 5 },
  Jordan:                    { center: [30.5852, 36.2384],  zoom: 7 },
  Kenya:                     { center: [-1.2864, 36.8172],  zoom: 7 },
  Lebanon:                   { center: [33.8547, 35.8623],  zoom: 8 },
  Libya:                     { center: [26.3351, 17.2283],  zoom: 6 },
  Madagascar:                { center: [-18.7669, 46.8691], zoom: 6 },
  Malawi:                    { center: [-13.2543, 34.3015], zoom: 7 },
  Malaysia:                  { center: [4.2105, 101.9758],  zoom: 6 },
  Mali:                      { center: [17.5707, -3.9962],  zoom: 6 },
  Mexico:                    { center: [23.6345, -102.5528],zoom: 5 },
  Morocco:                   { center: [31.7917, -7.0926],  zoom: 6 },
  Mozambique:                { center: [-18.6657, 35.5296], zoom: 6 },
  Myanmar:                   { center: [21.9162, 95.9560],  zoom: 6 },
  Nepal:                     { center: [28.3949, 84.1240],  zoom: 7 },
  Netherlands:               { center: [52.1326, 5.2913],   zoom: 7 },
  "New Zealand":             { center: [-40.9006, 174.8860],zoom: 6 },
  Nicaragua:                 { center: [12.8654, -85.2072], zoom: 7 },
  Nigeria:                   { center: [9.0820, 8.6753],    zoom: 6 },
  Norway:                    { center: [60.4720, 8.4689],   zoom: 6 },
  Pakistan:                  { center: [30.3753, 69.3451],  zoom: 6 },
  Palestine:                 { center: [31.9522, 35.2332],  zoom: 9 },
  Panama:                    { center: [8.5380, -80.7821],  zoom: 8 },
  "Papua New Guinea":        { center: [-6.3150, 143.9555], zoom: 6 },
  Paraguay:                  { center: [-23.4425, -58.4438],zoom: 7 },
  Peru:                      { center: [-9.1900, -75.0152], zoom: 6 },
  Philippines:               { center: [12.8797, 121.7740], zoom: 6 },
  Poland:                    { center: [51.9194, 19.1451],  zoom: 6 },
  Portugal:                  { center: [39.3999, -8.2245],  zoom: 7 },
  Romania:                   { center: [45.9432, 24.9668],  zoom: 7 },
  Russia:                    { center: [61.5240, 105.3188], zoom: 3 },
  Rwanda:                    { center: [-1.9403, 29.8739],  zoom: 9 },
  "Saudi Arabia":            { center: [23.8859, 45.0792],  zoom: 6 },
  Senegal:                   { center: [14.4974, -14.4524], zoom: 7 },
  "Sierra Leone":            { center: [8.4606, -11.7799],  zoom: 8 },
  "South Africa":            { center: [-30.5595, 22.9375], zoom: 6 },
  "South Korea":             { center: [35.9078, 127.7669], zoom: 7 },
  "South Sudan":             { center: [6.8770, 31.3070],   zoom: 6 },
  Spain:                     { center: [40.4637, -3.7492],  zoom: 6 },
  "Sri Lanka":               { center: [7.8731, 80.7718],   zoom: 8 },
  Sudan:                     { center: [12.8628, 30.2176],  zoom: 6 },
  Sweden:                    { center: [60.1282, 18.6435],  zoom: 6 },
  Switzerland:               { center: [46.8182, 8.2275],   zoom: 8 },
  Syria:                     { center: [34.8021, 38.9968],  zoom: 7 },
  Tanzania:                  { center: [-6.3690, 34.8888],  zoom: 6 },
  Thailand:                  { center: [15.8700, 100.9925], zoom: 6 },
  Togo:                      { center: [8.6195, 0.8248],    zoom: 8 },
  "Trinidad and Tobago":     { center: [10.6918, -61.2225], zoom: 9 },
  Tunisia:                   { center: [33.8869, 9.5375],   zoom: 7 },
  Turkey:                    { center: [38.9637, 35.2433],  zoom: 6 },
  Uganda:                    { center: [1.3733, 32.2903],   zoom: 7 },
  Ukraine:                   { center: [48.3794, 31.1656],  zoom: 6 },
  "United Arab Emirates":    { center: [23.4241, 53.8478],  zoom: 8 },
  "United Kingdom":          { center: [55.3781, -3.4360],  zoom: 6 },
  "United States":           { center: [37.0902, -95.7129], zoom: 4 },
  Uruguay:                   { center: [-32.5228, -55.7658],zoom: 7 },
  Venezuela:                 { center: [6.4238, -66.5897],  zoom: 6 },
  Vietnam:                   { center: [14.0583, 108.2772], zoom: 6 },
  Yemen:                     { center: [15.5527, 48.5164],  zoom: 6 },
  Zambia:                    { center: [-13.1339, 27.8493], zoom: 6 },
  Zimbabwe:                  { center: [-19.0154, 29.1549], zoom: 7 },
};

const DEFAULT_CENTER: [number, number] = [30, -20];
const DEFAULT_ZOOM = 3;

const GOLD = "#F5C000";
const BRAND_RED = "#E31C23";

const goldIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;background:${GOLD};border:2.5px solid #333;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -10],
});

function MapController({ country }: { country: string }) {
  const map = useMap();
  useEffect(() => {
    if (country === "All Countries") {
      map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 1 });
    } else {
      const loc = COUNTRY_COORDS[country];
      if (loc) map.flyTo(loc.center, loc.zoom, { duration: 1 });
    }
  }, [country, map]);
  return null;
}

function ResourceMap({ resources, country, approximate = false }: { resources: Resource[]; country: string; approximate?: boolean }) {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height: "520px", width: "100%", borderRadius: "12px" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController country={country} />
      {resources.map((item) => {
        const coords = COUNTRY_COORDS[item.country];
        if (!coords) return null;
        const jitter: [number, number] = approximate ? coords.center : [
          coords.center[0] + (Math.random() - 0.5) * 0.6,
          coords.center[1] + (Math.random() - 0.5) * 0.6,
        ];
        return (
          <Marker key={item._id} position={jitter} icon={goldIcon}>
            <Popup>
              <div style={{ minWidth: "180px", maxWidth: "220px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>
                  {item.title}
                </div>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>
                  {item.category} · {approximate ? `Country: ${item.country} (approximate)` : item.country}
                </div>
                <div style={{ fontSize: "12px", marginBottom: "10px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                  {item.description}
                </div>
                {item.contact?.website && (
                  <a
                    href={item.contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      padding: "4px 12px",
                      backgroundColor: BRAND_RED,
                      color: "#fff",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Visit
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

function ResourceCard({ item }: { item: Resource }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge
          variant="secondary"
          className="bg-accent/20 text-accent-foreground border-accent/30 text-xs font-bold"
        >
          {item.category}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {item.country}
        </Badge>
      </div>

      <h3 className="font-bold text-foreground text-base">{item.title}</h3>
      <p className="text-foreground/70 text-sm leading-relaxed">{item.description}</p>

      {item.contact && (
        <div className="flex flex-wrap gap-2 pt-1">
          {item.contact.phone && (
            <a
              href={`tel:${item.contact.phone}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline bg-secondary px-3 py-1.5 rounded-lg"
            >
              <Phone className="w-3.5 h-3.5" />
              {item.contact.phone}
            </a>
          )}
          {item.contact.email && (
            <a
              href={`mailto:${item.contact.email}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline bg-secondary px-3 py-1.5 rounded-lg"
            >
              <Mail className="w-3.5 h-3.5" />
              {item.contact.email}
            </a>
          )}
          {item.contact.website && (
            <a
              href={item.contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline bg-secondary px-3 py-1.5 rounded-lg"
            >
              <Globe className="w-3.5 h-3.5" />
              Website
            </a>
          )}
        </div>
      )}

      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((t) => (
            <span
              key={t}
              className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex gap-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-20" /></div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

type ViewMode = "grid" | "map";

export default function HelpPage() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <SignedInHelpPage /> : <VisitorHelpPage />;
}

/* Quick chips map onto real directory categories/keywords — no listings are invented. */
const QUICK: { label: string; terms: RegExp }[] = [
  { label: "Housing", terms: /housing|homeless|shelter/i },
  { label: "Legal", terms: /legal|law|justice|rights/i },
  { label: "Health", terms: /health|medical|clinic/i },
  { label: "Food", terms: /food|nutrition|meal|hunger/i },
  { label: "Money and debt", terms: /money|debt|financ|benefit|livelihood/i },
  { label: "Mental health", terms: /mental|counsel|wellbeing/i },
  { label: "Immigration advice", terms: /immigra|refugee|migrant|asylum|visa/i },
  { label: "Family and children", terms: /family|child|parent|youth/i },
];
const cleanLabel = (l: string) => l.replace(/\s*[\u{1F1E6}-\u{1F1FF}]{2}$/u, "");

function hasContact(r: Resource) { return !!(r.contact?.phone || r.contact?.email || r.contact?.website); }

function VisitorResourceCard({ item, onContact }: { item: Resource & { howToAccess?: string; city?: string }; onContact: () => void }) {
  const place = [item.city, item.country].filter(Boolean).join(", ");
  return (
    <article className="border-t-2 border-[#17100F] pt-4 flex flex-col rp-rise" data-testid={`card-help-${item._id}`}>
      <p className="rp-label !text-[12px] text-[#17100F]/75 inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{place || "Location to come"}</p>
      {item.category && <span className="mt-4 w-fit rp-label !text-[11px] bg-[#F3BF2C] text-[#17100F] px-2 py-1">{item.category}</span>}
      <h3 className="rp-display text-[30px] text-[#17100F] mt-3">{item.title}</h3>
      <p className="mt-3 text-[16px] leading-relaxed text-[#17100F]/80">{item.description}</p>
      {item.howToAccess && <p className="mt-3 text-[14px] text-[#17100F]/75"><b className="text-[#17100F]">How to access: </b>{item.howToAccess}</p>}
      {hasContact(item) && (
        <button type="button" onClick={onContact} className="rp-btn rp-btn-ghost mt-5 w-fit" data-testid={`button-contact-${item._id}`}>Contact details</button>
      )}
    </article>
  );
}

function VisitorHelpPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [country, setCountry] = useState("All Countries");
  const [chip, setChip] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [contact, setContact] = useState<Resource | null>(null);
  const q = useQuery({ queryKey: ["resources", "visitor-all"], queryFn: () => api.getResources({}) });
  const all = q.data ?? [];
  const terms = QUICK.find((c) => c.label === chip)?.terms;
  const needle = search.trim().toLowerCase();
  const filtered = all.filter((r) => {
    const hay = [r.title, r.category, r.description, r.country, ...(r.tags ?? [])].join(" ");
    return (category === "All Categories" || r.category === category)
      && (country === "All Countries" || r.country === country)
      && (!needle || hay.toLowerCase().includes(needle))
      && (!terms || terms.test(hay));
  });
  const clear = () => { setSearch(""); setCategory("All Categories"); setCountry("All Countries"); setChip(null); };

  return (
    <div className="max-w-[1240px] mx-auto px-5 md:px-8 py-12 md:py-16" data-testid="page-visitor-help">
      <VisitorHeading label="Get help" title="Get help" intro="Find grassroots organisations offering support with housing, legal problems, health and more." />
      <VisitorFilterBar search={search} onSearch={setSearch} placeholder="Search by need, name or place"
        country={country} onCountry={setCountry} countries={COUNTRIES.map((c) => ({ value: c.value, label: cleanLabel(c.label) }))}
        category={category} onCategory={setCategory} categoryLabel="Category"
        categories={CATEGORIES.map((c) => ({ value: c, label: c === "All Categories" ? "All categories" : c }))}
        view={viewMode} onView={setViewMode} />
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quick categories">
        {QUICK.map((c) => {
          const on = chip === c.label;
          return (
            <button key={c.label} type="button" aria-pressed={on} onClick={() => setChip(on ? null : c.label)}
              className={`h-10 px-4 border border-[#17100F] text-[14px] font-bold transition-colors ${on ? "bg-[#17100F] text-[#F4EFE6]" : "bg-transparent hover:bg-[#17100F]/5"}`}
              data-testid={`chip-help-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>{c.label}</button>
          );
        })}
      </div>

      <div className="mt-10">
        {q.isError ? (
          <div className="border border-[#17100F] bg-[#FBF8F2] p-8 md:p-10 text-center" role="alert" data-testid="status-help-error">
            <p className="rp-display text-[30px]">We couldn't load the directory</p>
            <p className="mt-2 text-[15px] text-[#17100F]/70">Check your connection and try again</p>
            <button type="button" onClick={() => q.refetch()} className="rp-btn rp-btn-yellow mt-5" data-testid="button-retry-help">Try again</button>
          </div>
        ) : viewMode === "map" ? (
          <div className="border border-[#17100F]"><ResourceMap resources={filtered} country={country} approximate /><p className="rp-label !text-[11px] text-[#17100F]/70 px-4 py-3 border-t border-[#17100F]" data-testid="text-help-map-note">Pins mark the country only, not a street address.</p></div>
        ) : q.isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-t-2 border-[#17100F]/20 pt-4 space-y-4 animate-pulse"><div className="h-3 w-28 bg-[#17100F]/10" /><div className="h-5 w-24 bg-[#17100F]/10" /><div className="h-8 w-3/4 bg-[#17100F]/10" /><div className="h-14 bg-[#17100F]/10" /></div>
            ))}
          </div>
        ) : all.length === 0 ? (
          <div className="border border-dashed border-[#17100F]/40 py-14 px-6 text-center" data-testid="status-help-empty">
            <p className="rp-display text-[30px]">The directory is being built</p>
            <p className="mt-2 text-[15px] text-[#17100F]/70">No organisations are listed yet. Please check back soon.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-[#17100F]/40 py-14 px-6 text-center" data-testid="status-help-no-match">
            <p className="rp-display text-[30px]">Nothing matches yet</p>
            <p className="mt-2 text-[15px] text-[#17100F]/70">Try a different search, country or category.</p>
            <button type="button" onClick={clear} className="rp-btn rp-btn-ghost mt-5" data-testid="button-help-clear">Clear filters</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {filtered.map((r) => <VisitorResourceCard key={r._id} item={r} onContact={() => setContact(r)} />)}
          </div>
        )}
      </div>

      <div className="mt-12 border-l-4 border-[#CA0813] bg-[#FBF8F2] px-5 py-4 text-[15px]" data-testid="text-help-emergency">
        <b>In an emergency, call 999 in the UK or 119 in Jamaica.</b> Root ProjX lists organisations but doesn’t give advice itself.
      </div>

      <Dialog open={!!contact} onOpenChange={(o) => { if (!o) setContact(null); }}>
        <DialogContent className="max-w-[380px] w-[calc(100vw-2rem)] rounded-none border border-[#17100F] bg-[#F4EFE6] p-6 [&>button:last-child]:hidden" data-testid="dialog-help-contact">
          <DialogClose className="absolute right-4 top-4 p-1" aria-label="Close"><X className="w-4 h-4" /></DialogClose>
          <DialogTitle className="rp-display text-[30px] pr-6">{contact?.title}</DialogTitle>
          <DialogDescription className="rp-label !text-[11px] text-[#CA0813]">Contact details</DialogDescription>
          <div className="mt-3 flex flex-col gap-3 text-[16px]">
            {contact?.contact?.phone && <a href={`tel:${contact.contact.phone}`} className="inline-flex items-center gap-2 font-bold"><Phone className="w-4 h-4" />{contact.contact.phone}</a>}
            {contact?.contact?.email && <a href={`mailto:${contact.contact.email}`} className="inline-flex items-center gap-2 font-bold break-all"><Mail className="w-4 h-4" />{contact.contact.email}</a>}
            {contact?.contact?.website && <a href={contact.contact.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-bold"><Globe className="w-4 h-4" /><span className="rp-link-u">Visit website</span></a>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SignedInHelpPage() {
  const [category, setCategory] = useState("All Categories");
  const [country, setCountry] = useState("All Countries");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const { data: resources = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["resources", category, country],
    queryFn: () =>
      api.getResources({
        category: category !== "All Categories" ? category : undefined,
        country: country !== "All Countries" ? country : undefined,
      }),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-foreground">Get Help Directory</h1>
        <p className="text-muted-foreground mt-1">
          Find grassroots support organisations for housing, legal, health, and more.
        </p>
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="h-10 px-3 text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            color: "#0f172a",
            borderRadius: "8px",
            width: "180px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          {COUNTRIES.map(({ label, value }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 px-3 text-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            color: "#0f172a",
            borderRadius: "8px",
            width: "200px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* View toggle */}
        <div className="flex-shrink-0 flex items-center gap-1 border border-border rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all"
            style={
              viewMode === "grid"
                ? { backgroundColor: GOLD, color: "#111" }
                : { backgroundColor: "transparent", color: BRAND_RED, border: "none" }
            }
          >
            <LayoutGrid className="w-4 h-4" />
            Grid
          </button>
          <button
            onClick={() => setViewMode("map")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all"
            style={
              viewMode === "map"
                ? { backgroundColor: GOLD, color: "#111" }
                : { backgroundColor: "transparent", color: BRAND_RED, border: "none" }
            }
          >
            <MapPin className="w-4 h-4" />
            Map
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "map" ? (
        <ResourceMap resources={resources} country={country} />
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-destructive mb-4">Could not load resources.</p>
          <Button onClick={() => refetch()} variant="outline">Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <ResourceSkeleton key={i} />)}
        </div>
      ) : resources.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No resources found for this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {resources.map((r) => <ResourceCard key={r._id} item={r} />)}
        </div>
      )}
    </div>
  );
}
