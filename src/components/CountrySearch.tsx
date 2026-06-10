'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, MapPin, ChevronDown } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   OSIRIS — Country Search
   Search all 195 UN-recognized countries + territories by name,
   fly the map to the selected country's center coordinates.
   No external API calls — fully static autocomplete.
   ═══════════════════════════════════════════════════════════════ */

interface CountryEntry {
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  flag: string;
}

const COUNTRIES: CountryEntry[] = [
  { name: 'Afghanistan', lat: 33.93911, lng: 67.709953, zoom: 5, flag: '🇦🇫' },
  { name: 'Albania', lat: 41.153332, lng: 20.168331, zoom: 7, flag: '🇦🇱' },
  { name: 'Algeria', lat: 28.033886, lng: 1.659626, zoom: 4.5, flag: '🇩🇿' },
  { name: 'Andorra', lat: 42.546245, lng: 1.601554, zoom: 10, flag: '🇦🇩' },
  { name: 'Angola', lat: -11.202692, lng: 17.873887, zoom: 5, flag: '🇦🇴' },
  { name: 'Antigua and Barbuda', lat: 17.060816, lng: -61.796428, zoom: 9, flag: '🇦🇬' },
  { name: 'Argentina', lat: -38.416097, lng: -63.616672, zoom: 3.5, flag: '🇦🇷' },
  { name: 'Armenia', lat: 40.069099, lng: 45.038189, zoom: 7, flag: '🇦🇲' },
  { name: 'Australia', lat: -25.274398, lng: 133.775136, zoom: 3.5, flag: '🇦🇺' },
  { name: 'Austria', lat: 47.516231, lng: 14.550072, zoom: 7, flag: '🇦🇹' },
  { name: 'Azerbaijan', lat: 40.143105, lng: 47.576927, zoom: 6, flag: '🇦🇿' },
  { name: 'Bahamas', lat: 25.03428, lng: -77.39628, zoom: 7, flag: '🇧🇸' },
  { name: 'Bahrain', lat: 25.930414, lng: 50.637772, zoom: 9, flag: '🇧🇭' },
  { name: 'Bangladesh', lat: 23.684994, lng: 90.356331, zoom: 6, flag: '🇧🇩' },
  { name: 'Barbados', lat: 13.193887, lng: -59.543198, zoom: 10, flag: '🇧🇧' },
  { name: 'Belarus', lat: 53.709807, lng: 27.953389, zoom: 6, flag: '🇧🇾' },
  { name: 'Belgium', lat: 50.503887, lng: 4.469936, zoom: 8, flag: '🇧🇪' },
  { name: 'Belize', lat: 17.189877, lng: -88.49765, zoom: 7, flag: '🇧🇿' },
  { name: 'Benin', lat: 9.30769, lng: 2.315834, zoom: 7, flag: '🇧🇯' },
  { name: 'Bhutan', lat: 27.514162, lng: 90.433601, zoom: 7, flag: '🇧🇹' },
  { name: 'Bolivia', lat: -16.290154, lng: -63.588653, zoom: 5, flag: '🇧🇴' },
  { name: 'Bosnia and Herzegovina', lat: 43.915886, lng: 17.679076, zoom: 7, flag: '🇧🇦' },
  { name: 'Botswana', lat: -22.328474, lng: 24.684866, zoom: 6, flag: '🇧🇼' },
  { name: 'Brazil', lat: -14.235004, lng: -51.92528, zoom: 3, flag: '🇧🇷' },
  { name: 'Brunei', lat: 4.535277, lng: 114.727669, zoom: 8, flag: '🇧🇳' },
  { name: 'Bulgaria', lat: 42.733883, lng: 25.48583, zoom: 7, flag: '🇧🇬' },
  { name: 'Burkina Faso', lat: 12.238333, lng: -1.561593, zoom: 6, flag: '🇧🇫' },
  { name: 'Burundi', lat: -3.373056, lng: 29.918886, zoom: 8, flag: '🇧🇮' },
  { name: 'Cabo Verde', lat: 16.002082, lng: -24.013197, zoom: 8, flag: '🇨🇻' },
  { name: 'Cambodia', lat: 12.565679, lng: 104.990963, zoom: 6, flag: '🇰🇭' },
  { name: 'Cameroon', lat: 7.369722, lng: 12.354722, zoom: 6, flag: '🇨🇲' },
  { name: 'Canada', lat: 56.130366, lng: -106.346771, zoom: 3, flag: '🇨🇦' },
  { name: 'Central African Republic', lat: 6.611111, lng: 20.939444, zoom: 5, flag: '🇨🇫' },
  { name: 'Chad', lat: 15.454166, lng: 18.732207, zoom: 5, flag: '🇹🇩' },
  { name: 'Chile', lat: -35.675147, lng: -71.542969, zoom: 4, flag: '🇨🇱' },
  { name: 'China', lat: 35.86166, lng: 104.195397, zoom: 3.5, flag: '🇨🇳' },
  { name: 'Colombia', lat: 4.570868, lng: -74.297333, zoom: 5, flag: '🇨🇴' },
  { name: 'Comoros', lat: -11.875001, lng: 43.872219, zoom: 9, flag: '🇰🇲' },
  { name: 'Congo (DRC)', lat: -4.038333, lng: 21.758664, zoom: 4.5, flag: '🇨🇩' },
  { name: 'Congo (Republic)', lat: -0.228021, lng: 15.827659, zoom: 6, flag: '🇨🇬' },
  { name: 'Costa Rica', lat: 9.748917, lng: -83.753428, zoom: 7, flag: '🇨🇷' },
  { name: 'Croatia', lat: 45.1, lng: 15.2, zoom: 7, flag: '🇭🇷' },
  { name: 'Cuba', lat: 21.521757, lng: -77.781167, zoom: 6, flag: '🇨🇺' },
  { name: 'Cyprus', lat: 35.126413, lng: 33.429859, zoom: 8, flag: '🇨🇾' },
  { name: 'Czech Republic', lat: 49.817492, lng: 15.472962, zoom: 7, flag: '🇨🇿' },
  { name: 'Denmark', lat: 56.26392, lng: 9.501785, zoom: 7, flag: '🇩🇰' },
  { name: 'Djibouti', lat: 11.825138, lng: 42.590275, zoom: 8, flag: '🇩🇯' },
  { name: 'Dominica', lat: 15.414999, lng: -61.370976, zoom: 10, flag: '🇩🇲' },
  { name: 'Dominican Republic', lat: 18.735693, lng: -70.162651, zoom: 7, flag: '🇩🇴' },
  { name: 'Ecuador', lat: -1.831239, lng: -78.183406, zoom: 6, flag: '🇪🇨' },
  { name: 'Egypt', lat: 26.820553, lng: 30.802498, zoom: 5, flag: '🇪🇬' },
  { name: 'El Salvador', lat: 13.794185, lng: -88.89653, zoom: 8, flag: '🇸🇻' },
  { name: 'Equatorial Guinea', lat: 1.650801, lng: 10.267895, zoom: 8, flag: '🇬🇶' },
  { name: 'Eritrea', lat: 15.179384, lng: 39.782334, zoom: 7, flag: '🇪🇷' },
  { name: 'Estonia', lat: 58.595272, lng: 25.013607, zoom: 7, flag: '🇪🇪' },
  { name: 'Eswatini', lat: -26.522503, lng: 31.465866, zoom: 8, flag: '🇸🇿' },
  { name: 'Ethiopia', lat: 9.145, lng: 40.489673, zoom: 5, flag: '🇪🇹' },
  { name: 'Fiji', lat: -16.578193, lng: 179.414413, zoom: 7, flag: '🇫🇯' },
  { name: 'Finland', lat: 61.92411, lng: 25.748151, zoom: 5, flag: '🇫🇮' },
  { name: 'France', lat: 46.603354, lng: 1.888334, zoom: 5, flag: '🇫🇷' },
  { name: 'Gabon', lat: -0.803689, lng: 11.609444, zoom: 6, flag: '🇬🇦' },
  { name: 'Gambia', lat: 13.443182, lng: -15.310139, zoom: 8, flag: '🇬🇲' },
  { name: 'Georgia', lat: 42.315407, lng: 43.356892, zoom: 7, flag: '🇬🇪' },
  { name: 'Germany', lat: 51.165691, lng: 10.451526, zoom: 5, flag: '🇩🇪' },
  { name: 'Ghana', lat: 7.946527, lng: -1.023194, zoom: 6, flag: '🇬🇭' },
  { name: 'Greece', lat: 39.074208, lng: 21.824312, zoom: 6, flag: '🇬🇷' },
  { name: 'Grenada', lat: 12.262776, lng: -61.604171, zoom: 10, flag: '🇬🇩' },
  { name: 'Guatemala', lat: 15.783471, lng: -90.230759, zoom: 7, flag: '🇬🇹' },
  { name: 'Guinea', lat: 9.945587, lng: -9.696645, zoom: 6, flag: '🇬🇳' },
  { name: 'Guinea-Bissau', lat: 11.803749, lng: -15.180413, zoom: 7, flag: '🇬🇼' },
  { name: 'Guyana', lat: 4.860416, lng: -58.93018, zoom: 7, flag: '🇬🇾' },
  { name: 'Haiti', lat: 18.971187, lng: -72.285215, zoom: 7, flag: '🇭🇹' },
  { name: 'Honduras', lat: 15.199999, lng: -86.241905, zoom: 7, flag: '🇭🇳' },
  { name: 'Hungary', lat: 47.162494, lng: 19.503304, zoom: 7, flag: '🇭🇺' },
  { name: 'Iceland', lat: 64.963051, lng: -19.020835, zoom: 6, flag: '🇮🇸' },
  { name: 'India', lat: 20.593684, lng: 78.96288, zoom: 4, flag: '🇮🇳' },
  { name: 'Indonesia', lat: -0.789275, lng: 113.921327, zoom: 4, flag: '🇮🇩' },
  { name: 'Iran', lat: 32.427908, lng: 53.688046, zoom: 4.5, flag: '🇮🇷' },
  { name: 'Iraq', lat: 33.223191, lng: 43.679291, zoom: 5, flag: '🇮🇶' },
  { name: 'Ireland', lat: 53.41291, lng: -8.24389, zoom: 6, flag: '🇮🇪' },
  { name: 'Israel', lat: 31.046051, lng: 34.851612, zoom: 7, flag: '🇮🇱' },
  { name: 'Italy', lat: 41.87194, lng: 12.56738, zoom: 5, flag: '🇮🇹' },
  { name: 'Ivory Coast', lat: 7.539989, lng: -5.54708, zoom: 6, flag: '🇨🇮' },
  { name: 'Jamaica', lat: 18.109581, lng: -77.297508, zoom: 8, flag: '🇯🇲' },
  { name: 'Japan', lat: 36.204824, lng: 138.252924, zoom: 5, flag: '🇯🇵' },
  { name: 'Jordan', lat: 30.585164, lng: 36.238414, zoom: 7, flag: '🇯🇴' },
  { name: 'Kazakhstan', lat: 48.019573, lng: 66.923684, zoom: 4, flag: '🇰🇿' },
  { name: 'Kenya', lat: -0.023559, lng: 37.906193, zoom: 5, flag: '🇰🇪' },
  { name: 'Kiribati', lat: -3.370417, lng: -168.734039, zoom: 7, flag: '🇰🇮' },
  { name: 'Kuwait', lat: 29.31166, lng: 47.481766, zoom: 8, flag: '🇰🇼' },
  { name: 'Kyrgyzstan', lat: 41.20438, lng: 74.766098, zoom: 6, flag: '🇰🇬' },
  { name: 'Laos', lat: 19.85627, lng: 102.495496, zoom: 6, flag: '🇱🇦' },
  { name: 'Latvia', lat: 56.879635, lng: 24.603189, zoom: 7, flag: '🇱🇻' },
  { name: 'Lebanon', lat: 33.854721, lng: 35.862285, zoom: 8, flag: '🇱🇧' },
  { name: 'Lesotho', lat: -29.609988, lng: 28.233608, zoom: 8, flag: '🇱🇸' },
  { name: 'Liberia', lat: 6.428055, lng: -9.429499, zoom: 7, flag: '🇱🇷' },
  { name: 'Libya', lat: 26.3351, lng: 17.228331, zoom: 5, flag: '🇱🇾' },
  { name: 'Liechtenstein', lat: 47.166, lng: 9.555373, zoom: 10, flag: '🇱🇮' },
  { name: 'Lithuania', lat: 55.169438, lng: 23.881275, zoom: 7, flag: '🇱🇹' },
  { name: 'Luxembourg', lat: 49.815273, lng: 6.129583, zoom: 9, flag: '🇱🇺' },
  { name: 'Madagascar', lat: -18.766947, lng: 46.869107, zoom: 5, flag: '🇲🇬' },
  { name: 'Malawi', lat: -13.254308, lng: 34.301525, zoom: 6, flag: '🇲🇼' },
  { name: 'Malaysia', lat: 4.210484, lng: 101.975766, zoom: 5, flag: '🇲🇾' },
  { name: 'Maldives', lat: 3.202778, lng: 73.22068, zoom: 9, flag: '🇲🇻' },
  { name: 'Mali', lat: 17.570692, lng: -3.996166, zoom: 5, flag: '🇲🇱' },
  { name: 'Malta', lat: 35.937496, lng: 14.375416, zoom: 10, flag: '🇲🇹' },
  { name: 'Marshall Islands', lat: 7.131474, lng: 171.184478, zoom: 8, flag: '🇲🇭' },
  { name: 'Mauritania', lat: 21.00789, lng: -10.940835, zoom: 5, flag: '🇲🇷' },
  { name: 'Mauritius', lat: -20.348404, lng: 57.552152, zoom: 9, flag: '🇲🇺' },
  { name: 'Mexico', lat: 23.634501, lng: -102.552784, zoom: 4, flag: '🇲🇽' },
  { name: 'Micronesia', lat: 7.425554, lng: 150.550812, zoom: 8, flag: '🇫🇲' },
  { name: 'Moldova', lat: 47.411631, lng: 28.369885, zoom: 7, flag: '🇲🇩' },
  { name: 'Monaco', lat: 43.750298, lng: 7.412841, zoom: 12, flag: '🇲🇨' },
  { name: 'Mongolia', lat: 46.862496, lng: 103.846656, zoom: 5, flag: '🇲🇳' },
  { name: 'Montenegro', lat: 42.708678, lng: 19.37439, zoom: 8, flag: '🇲🇪' },
  { name: 'Morocco', lat: 31.791702, lng: -7.09262, zoom: 5, flag: '🇲🇦' },
  { name: 'Mozambique', lat: -18.665695, lng: 35.529562, zoom: 5, flag: '🇲🇿' },
  { name: 'Myanmar', lat: 21.913965, lng: 95.956223, zoom: 5, flag: '🇲🇲' },
  { name: 'Namibia', lat: -22.95764, lng: 18.49041, zoom: 5, flag: '🇳🇦' },
  { name: 'Nauru', lat: -0.522778, lng: 166.931503, zoom: 11, flag: '🇳🇷' },
  { name: 'Nepal', lat: 28.394857, lng: 84.124008, zoom: 6, flag: '🇳🇵' },
  { name: 'Netherlands', lat: 52.132633, lng: 5.291266, zoom: 7, flag: '🇳🇱' },
  { name: 'New Zealand', lat: -40.900557, lng: 174.885971, zoom: 5, flag: '🇳🇿' },
  { name: 'Nicaragua', lat: 12.865416, lng: -85.207229, zoom: 6, flag: '🇳🇮' },
  { name: 'Niger', lat: 17.607789, lng: 8.081666, zoom: 5, flag: '🇳🇪' },
  { name: 'Nigeria', lat: 9.081999, lng: 8.675277, zoom: 5, flag: '🇳🇬' },
  { name: 'North Korea', lat: 40.339852, lng: 127.510093, zoom: 6, flag: '🇰🇵' },
  { name: 'North Macedonia', lat: 41.608635, lng: 21.745275, zoom: 8, flag: '🇲🇰' },
  { name: 'Norway', lat: 60.472024, lng: 8.468946, zoom: 4.5, flag: '🇳🇴' },
  { name: 'Oman', lat: 21.512583, lng: 55.923255, zoom: 5, flag: '🇴🇲' },
  { name: 'Pakistan', lat: 30.375321, lng: 69.345116, zoom: 4.5, flag: '🇵🇰' },
  { name: 'Palau', lat: 7.51498, lng: 134.58252, zoom: 9, flag: '🇵🇼' },
  { name: 'Palestine', lat: 31.947352, lng: 35.227167, zoom: 8, flag: '🇵🇸' },
  { name: 'Panama', lat: 8.537981, lng: -80.782127, zoom: 7, flag: '🇵🇦' },
  { name: 'Papua New Guinea', lat: -6.314993, lng: 143.95555, zoom: 5, flag: '🇵🇬' },
  { name: 'Paraguay', lat: -23.442503, lng: -58.443832, zoom: 6, flag: '🇵🇾' },
  { name: 'Peru', lat: -9.189967, lng: -75.015152, zoom: 5, flag: '🇵🇪' },
  { name: 'Philippines', lat: 12.879721, lng: 121.774017, zoom: 5, flag: '🇵🇭' },
  { name: 'Poland', lat: 51.919438, lng: 19.145136, zoom: 5, flag: '🇵🇱' },
  { name: 'Portugal', lat: 39.399872, lng: -8.224454, zoom: 6, flag: '🇵🇹' },
  { name: 'Qatar', lat: 25.354826, lng: 51.183884, zoom: 8, flag: '🇶🇦' },
  { name: 'Romania', lat: 45.943161, lng: 24.96676, zoom: 6, flag: '🇷🇴' },
  { name: 'Russia', lat: 61.52401, lng: 105.318756, zoom: 2.5, flag: '🇷🇺' },
  { name: 'Rwanda', lat: -1.940278, lng: 29.873888, zoom: 8, flag: '🇷🇼' },
  { name: 'Saint Kitts and Nevis', lat: 17.357822, lng: -62.782998, zoom: 10, flag: '🇰🇳' },
  { name: 'Saint Lucia', lat: 13.909444, lng: -60.978893, zoom: 10, flag: '🇱🇨' },
  { name: 'Saint Vincent', lat: 12.984305, lng: -61.287228, zoom: 10, flag: '🇻🇨' },
  { name: 'Samoa', lat: -13.759029, lng: -172.104629, zoom: 8, flag: '🇼🇸' },
  { name: 'San Marino', lat: 43.94236, lng: 12.457777, zoom: 11, flag: '🇸🇲' },
  { name: 'Sao Tome and Principe', lat: 0.18636, lng: 6.613081, zoom: 10, flag: '🇸🇹' },
  { name: 'Saudi Arabia', lat: 23.885942, lng: 45.079162, zoom: 4.5, flag: '🇸🇦' },
  { name: 'Senegal', lat: 14.497401, lng: -14.452362, zoom: 6, flag: '🇸🇳' },
  { name: 'Serbia', lat: 44.016521, lng: 21.005859, zoom: 7, flag: '🇷🇸' },
  { name: 'Seychelles', lat: -4.679574, lng: 55.491977, zoom: 9, flag: '🇸🇨' },
  { name: 'Sierra Leone', lat: 8.460555, lng: -11.779889, zoom: 7, flag: '🇸🇱' },
  { name: 'Singapore', lat: 1.352083, lng: 103.819836, zoom: 10, flag: '🇸🇬' },
  { name: 'Slovakia', lat: 48.669026, lng: 19.699024, zoom: 7, flag: '🇸🇰' },
  { name: 'Slovenia', lat: 46.151241, lng: 14.995463, zoom: 8, flag: '🇸🇮' },
  { name: 'Solomon Islands', lat: -9.64571, lng: 160.156194, zoom: 7, flag: '🇸🇧' },
  { name: 'Somalia', lat: 5.152149, lng: 46.199616, zoom: 5, flag: '🇸🇴' },
  { name: 'South Africa', lat: -30.559482, lng: 22.937506, zoom: 4.5, flag: '🇿🇦' },
  { name: 'South Korea', lat: 35.907757, lng: 127.766922, zoom: 6, flag: '🇰🇷' },
  { name: 'South Sudan', lat: 6.876991, lng: 31.306978, zoom: 6, flag: '🇸🇸' },
  { name: 'Spain', lat: 40.463667, lng: -3.74922, zoom: 5, flag: '🇪🇸' },
  { name: 'Sri Lanka', lat: 7.873054, lng: 80.771797, zoom: 7, flag: '🇱🇰' },
  { name: 'Sudan', lat: 12.862807, lng: 30.217636, zoom: 5, flag: '🇸🇩' },
  { name: 'Suriname', lat: 3.919305, lng: -56.027783, zoom: 7, flag: '🇸🇷' },
  { name: 'Sweden', lat: 60.128161, lng: 18.643501, zoom: 4.5, flag: '🇸🇪' },
  { name: 'Switzerland', lat: 46.818188, lng: 8.227512, zoom: 7, flag: '🇨🇭' },
  { name: 'Syria', lat: 34.802075, lng: 38.996815, zoom: 6, flag: '🇸🇾' },
  { name: 'Taiwan', lat: 23.69781, lng: 120.960515, zoom: 7, flag: '🇹🇼' },
  { name: 'Tajikistan', lat: 38.861034, lng: 71.276093, zoom: 6, flag: '🇹🇯' },
  { name: 'Tanzania', lat: -6.369028, lng: 34.888822, zoom: 5, flag: '🇹🇿' },
  { name: 'Thailand', lat: 15.870032, lng: 100.992541, zoom: 5, flag: '🇹🇭' },
  { name: 'Timor-Leste', lat: -8.874217, lng: 125.727539, zoom: 8, flag: '🇹🇱' },
  { name: 'Togo', lat: 8.619543, lng: 0.824782, zoom: 7, flag: '🇹🇬' },
  { name: 'Tonga', lat: -21.178986, lng: -175.198242, zoom: 8, flag: '🇹🇴' },
  { name: 'Trinidad and Tobago', lat: 10.691803, lng: -61.222503, zoom: 9, flag: '🇹🇹' },
  { name: 'Tunisia', lat: 33.886917, lng: 9.537499, zoom: 6, flag: '🇹🇳' },
  { name: 'Turkey', lat: 38.963745, lng: 35.243322, zoom: 5, flag: '🇹🇷' },
  { name: 'Turkmenistan', lat: 38.969719, lng: 59.556278, zoom: 5, flag: '🇹🇲' },
  { name: 'Tuvalu', lat: -7.109535, lng: 177.64933, zoom: 11, flag: '🇹🇻' },
  { name: 'Uganda', lat: 1.373333, lng: 32.290275, zoom: 6, flag: '🇺🇬' },
  { name: 'Ukraine', lat: 48.379433, lng: 31.16558, zoom: 5, flag: '🇺🇦' },
  { name: 'United Arab Emirates', lat: 23.424076, lng: 53.847818, zoom: 6, flag: '🇦🇪' },
  { name: 'United Kingdom', lat: 55.378051, lng: -3.435973, zoom: 5, flag: '🇬🇧' },
  { name: 'United States', lat: 37.09024, lng: -95.712891, zoom: 3.5, flag: '🇺🇸' },
  { name: 'Uruguay', lat: -32.522779, lng: -55.765835, zoom: 7, flag: '🇺🇾' },
  { name: 'Uzbekistan', lat: 41.377491, lng: 64.585262, zoom: 5, flag: '🇺🇿' },
  { name: 'Vanuatu', lat: -15.376706, lng: 166.959158, zoom: 7, flag: '🇻🇺' },
  { name: 'Vatican City', lat: 41.902916, lng: 12.453389, zoom: 13, flag: '🇻🇦' },
  { name: 'Venezuela', lat: 6.42375, lng: -66.58973, zoom: 5, flag: '🇻🇪' },
  { name: 'Vietnam', lat: 14.058324, lng: 108.277199, zoom: 5, flag: '🇻🇳' },
  { name: 'Yemen', lat: 15.552727, lng: 48.516388, zoom: 5, flag: '🇾🇪' },
  { name: 'Zambia', lat: -13.133897, lng: 27.849332, zoom: 6, flag: '🇿🇲' },
  { name: 'Zimbabwe', lat: -19.015438, lng: 29.154857, zoom: 6, flag: '🇿🇼' },
  // Additional territories
  { name: 'Greenland', lat: 71.706936, lng: -42.604303, zoom: 4, flag: '🇬🇱' },
  { name: 'Puerto Rico', lat: 18.220833, lng: -66.590149, zoom: 8, flag: '🇵🇷' },
  { name: 'Hong Kong', lat: 22.396428, lng: 114.109497, zoom: 9, flag: '🇭🇰' },
  { name: 'Kosovo', lat: 42.602636, lng: 20.902977, zoom: 8, flag: '🇽🇰' },
];

interface CountrySearchProps {
  onLocate: (lat: number, lng: number) => void;
}

export default function CountrySearch({ onLocate }: CountrySearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return COUNTRIES.slice(0, 30); // show first 30 as suggestions
    const q = query.toLowerCase();
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.flag.includes(q)
    ).slice(0, 50);
  }, [query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSelect = (c: CountryEntry) => {
    onLocate(c.lat, c.lng);
    setOpen(false);
    setQuery('');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 glass-panel-sm px-3 py-2 text-[9px] font-mono tracking-[0.15em] text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:border-[var(--border-active)] transition-all hover:shadow-[0_0_12px_rgba(212,175,55,0.08)]"
      >
        <MapPin className="w-3 h-3" />
        SEARCH COUNTRY
      </button>
    );
  }

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 glass-panel px-3 py-2.5 !border-[var(--border-active)]">
        <Search className="w-3.5 h-3.5 text-[var(--gold-primary)] flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); setQuery(''); }
            if (e.key === 'Enter' && filtered.length > 0) handleSelect(filtered[0]);
          }}
          placeholder="TYPE COUNTRY NAME..."
          className="flex-1 bg-transparent text-[10px] text-[var(--text-primary)] font-mono tracking-wider outline-none placeholder:text-[var(--text-muted)]"
        />
        <span className="text-[7px] text-[var(--text-muted)] font-mono">{COUNTRIES.length} COUNTRIES</span>
        <button onClick={() => { setOpen(false); setQuery(''); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <X className="w-3 h-3" />
        </button>
      </div>

      {filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 glass-panel overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] max-h-[250px] overflow-y-auto styled-scrollbar z-50">
          {filtered.map((c, i) => (
            <button
              key={c.name}
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 hover:bg-[var(--hover-accent)] transition-colors border-b border-[var(--border-secondary)] last:border-0 flex items-center gap-2"
            >
              <span className="text-[14px] flex-shrink-0">{c.flag}</span>
              <span className="text-[10px] text-[var(--text-primary)] font-mono">{c.name}</span>
              <span className="ml-auto text-[7px] text-[var(--text-muted)] font-mono">
                {c.lat.toFixed(1)}, {c.lng.toFixed(1)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
