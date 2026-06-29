import React from 'react';
import { Issue, Comment, UserProfile } from '../types';
import ResolutionAgentPanel from './ResolutionAgentPanel';
import { 
  X, MapPin, Sparkles, ThumbsUp, CheckCircle, Award, Share2, HeartHandshake, Camera, Calendar, 
  RefreshCw, FileText, TableProperties, CalendarDays, CheckSquare, FileEdit, Loader, Send, 
  User, MessageSquare, ArrowUpRight, MessageSquareShare, Phone, ShieldAlert, Building
} from 'lucide-react';
import { NANO_MASCOT_URL } from './FeedView';
import { exportPetitionToDocs, scheduleCommunityMeet } from '../utils/googleWorkspace';

export interface IssueDetailModalProps {
  issue: Issue;
  recentIssues?: Issue[];
  onUpdateIssue?: (updates: Partial<Issue>) => void;
  onAddCommentLocal?: (comment: Comment) => void;
  currentUserProfile?: UserProfile | null;
  handleToggleEmergencyAttention?: (issue: Issue) => void;
  onClose: () => void;
  currentUser: any;
  accessToken: string | null;
  onSelectMapLocation?: (lat: number, lng: number) => void;
  comments: Comment[];
  newComment: string;
  setNewComment: (val: string) => void;
  handleSubmitComment: (e: React.FormEvent) => void;
  isAiLoading: boolean;
  hasUpvoted?: boolean;
  handleUpvote: (issue: Issue, e: React.MouseEvent) => void;
  handleVerifyEyewitness: (issue: Issue, e: React.MouseEvent) => void;
  handleAmplify: (issue: Issue) => void;
  isAmplifying: boolean;
  amplifiedMessage: string | null;
  isResolving: boolean;
  setIsResolving: (val: boolean) => void;
  handleResolveProofUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  resolveMedia: string | null;
  handleVerifyResolution: () => void;
  isVerifyingFix: boolean;
  fixVerdict: string | null;
  generateICSFile: (issue: Issue) => void;
  isWorkspaceActionLoading: boolean;
  workspaceActionFeedback: string | null;
  workspaceActionLink: string | null;
  workspaceActionError: string | null;
  chatSpaces: any[];
  isChatSpacesLoading: boolean;
  selectedSpaceName: string;
  setSelectedSpaceName: (val: string) => void;
  handleSendChatAlert: () => void;
  handleSaveKeepNote: () => void;
  handleExportToDocs: () => void;
  handleExportToSheets: () => void;
  handleScheduleCalendar: () => void;
  handleCreateTask: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const AUTHORITY_CONTACTS_FALLBACK: Record<string, {
  department: string;
  phone: string;
  description: string;
  websiteSearch: string;
  instructions: string[];
}> = {
  'Roads': {
    department: 'Municipal Public Works / Department of Transportation',
    phone: '311',
    description: 'Responsible for road resurfacing, pothole filling, missing/broken signs, and traffic signal outages.',
    websiteSearch: 'report pothole DOT website service portal',
    instructions: [
      'Call 311 (or local municipal city service line) to report road hazards immediately.',
      'Specify the nearest intersection or street address for faster dispatch.',
      'Online filing is available on most municipal 311 portal maps (e.g. NYC311, LA311, Toronto 311).'
    ]
  },
  'Drainage': {
    department: 'Water & Stormwater Management Department',
    phone: '311',
    description: 'Responsible for storm drain maintenance, catch basin clearing, and street flooding hazards.',
    websiteSearch: 'report stormwater drainage overflow city municipal portal',
    instructions: [
      'Call 311 or the local Water Utility Emergency hotline for active street flooding.',
      'Never attempt to lift or clear metal storm grates yourself during active storms.',
      'Give precise cross-streets so crews can locate clogged underground catch basins.'
    ]
  },
  'Streetlight': {
    department: 'Local Power Utility / Street Lighting Division',
    phone: '311',
    description: 'Handles damaged street lamps, blackout areas, flickering lights, and physical pole damage.',
    websiteSearch: 'report streetlight outage power utility service link',
    instructions: [
      'Locate the 6-to-8-character code stamped directly onto the light pole at eye-level.',
      'Submit the pole ID to the local electricity provider (e.g. PG&E, BC Hydro, ConEd) for immediate scheduling.',
      'For immediate safety hazards like exposed wires, stay back and dial 911.'
    ]
  },
  'Sanitation': {
    department: 'Department of Sanitation / Waste Management Services',
    phone: '311',
    description: 'Manages trash collection, public litter bins, illegal dumping sites, and graffiti removal.',
    websiteSearch: 'report illegal dumping sanitation community cleanup portal',
    instructions: [
      'Report illegal dumping on public property to Sanitation via 311.',
      'Most cities have free graffiti removal programs—file a service request to clear tagged walls.',
      'Do not touch or approach illegal chemical/battery dumping sites.'
    ]
  },
  'Water': {
    department: 'Municipal Water & Sewer Utility Authority',
    phone: '311',
    description: 'Resolves gushing water mains, leaking fire hydrants, low water pressure, and main break emergencies.',
    websiteSearch: 'water emergency main break report utility service link',
    instructions: [
      'Report water main breaks immediately to your city Water Authority dispatch or dial 311.',
      'For gushing fire hydrants, contact local water services. Do not try to close them yourself.',
      'Stay away from pooling water that may conceal expanding washouts/sinkholes.'
    ]
  },
  'Public Safety': {
    department: 'Police Department (Non-Emergency) / Code Enforcement',
    phone: '311',
    description: 'Handles sidewalk obstructions, dangerous overgrown branches, structural code violations, and public hazards.',
    websiteSearch: 'city code enforcement non emergency hazard report portal',
    instructions: [
      'Call your precinct’s specific 10-digit Non-Emergency line, or 311 for local assistance.',
      'For dangerous hanging trees on power lines, contact both the city park forestry division and the electric utility.',
      'In a life-threatening crisis or active safety threat, dial 911 immediately.'
    ]
  },
  'Electrical': {
    department: 'Electricity Utility Company Dispatch & Emergency Fire Services',
    phone: '911',
    description: 'Handles active electrical line hazards, sparking transformers, power outages, and grid failures.',
    websiteSearch: 'report downed power lines utility emergency live hazard line',
    instructions: [
      'Stay at least 35 feet away from any downed or hanging power lines and keep others away.',
      'Treat all hanging wires as fully live and fatal. Do not touch adjacent fences or trees.',
      'Dial 911 immediately for sparks, smoke, fires, or downed power lines.'
    ]
  },
  'Other': {
    department: 'Municipal Council Office / Mayor\'s Community Liaison',
    phone: '311',
    description: 'General inquiry and community issues coordination.',
    websiteSearch: 'contact local ward alderman city council non emergency services',
    instructions: [
      'Use 311 to trace the correct public sector agency for uncommon or custom requests.',
      'Consider reaching out directly to your Ward Councillor, Alderman, or Community Board.',
      'You can also utilize our Google Workspace tools to export a petition directly to Docs to email your leader.'
    ]
  }
};

function getDynamicContactForIssue(category: string, address: string): {
  countryName: string;
  countryFlag: string;
  department: string;
  phone: string;
  description: string;
  websiteSearch: string;
  instructions: string[];
} {
  const addr = (address || '').toLowerCase();
  
  // Detect Country
  let country = 'usa'; // default
  let countryName = 'United States';
  let countryFlag = '🇺🇸';

  if (addr.includes('india') || addr.includes('mumbai') || addr.includes('delhi') || addr.includes('bengaluru') || addr.includes('bangalore') || addr.includes('chennai') || addr.includes('kolkata') || addr.includes('pune') || addr.includes('hyderabad')) {
    country = 'india';
    countryName = 'India';
    countryFlag = '🇮🇳';
  } else if (addr.includes('belgium') || addr.includes('belgique') || addr.includes('belgië') || addr.includes('brussels') || addr.includes('bruxelles') || addr.includes('antwerp') || addr.includes('ghent') || addr.includes('leuven') || addr.includes('liège')) {
    country = 'belgium';
    countryName = 'Belgium';
    countryFlag = '🇧🇪';
  } else if (addr.includes('united kingdom') || addr.includes('uk') || addr.includes('england') || addr.includes('scotland') || addr.includes('london') || addr.includes('manchester') || addr.includes('birmingham') || addr.includes('glasgow') || addr.includes('leeds')) {
    country = 'uk';
    countryName = 'United Kingdom';
    countryFlag = '🇬🇧';
  } else if (addr.includes('canada') || addr.includes('toronto') || addr.includes('vancouver') || addr.includes('montreal') || addr.includes('calgary') || addr.includes('ottawa') || addr.includes('halifax') || addr.includes('winnipeg') || addr.includes('edmonton')) {
    country = 'canada';
    countryName = 'Canada';
    countryFlag = '🇨🇦';
  } else if (addr.includes('australia') || addr.includes('sydney') || addr.includes('melbourne') || addr.includes('brisbane') || addr.includes('perth') || addr.includes('adelaide')) {
    country = 'australia';
    countryName = 'Australia';
    countryFlag = '🇦🇺';
  } else if (addr.includes('germany') || addr.includes('deutschland') || addr.includes('berlin') || addr.includes('münchen') || addr.includes('munich') || addr.includes('hamburg') || addr.includes('frankfurt')) {
    country = 'germany';
    countryName = 'Germany';
    countryFlag = '🇩🇪';
  }

  // Tailored parameters per Country and Category
  if (country === 'india') {
    switch (category) {
      case 'Roads':
        return {
          countryName, countryFlag,
          department: 'Municipal Corporation (BMC, BBMP, MCD, etc.) / Public Works Department (PWD)',
          phone: '1916',
          description: 'Responsible for road maintenance, pothole patching, open trenching restoration, and traffic signal defects.',
          websiteSearch: 'report pothole municipal corporation online complaint portal',
          instructions: [
            'Log your road complaint via localized municipal portals (e.g. BBMP Sahaaya, MCGM 24x7 app, or MCD 311).',
            'Provide nearest crossroad, circle (chowk), or landmark to assist the local ward engineer.',
            'For major highways crossing the city, file directly with the NHAI (National Highways Authority of India) portal.'
          ]
        };
      case 'Drainage':
        return {
          countryName, countryFlag,
          department: 'Stormwater Drainage (SWD) Department / Water Supply Sewerage Board',
          phone: '1916',
          description: 'Manages gutter blockages, culvert silting, stormwater canal flooding, and missing drain cover grids.',
          websiteSearch: 'clogged stormwater drain municipal corporation complaint board',
          instructions: [
            'Report open gutter covers or active stormwater flooding to your ward councillor or local ward control office.',
            'Keep clear of deep open nullahs or stagnant waterlogged spots during monsoons to avoid injury risks.',
            'Maintain safe spacing as sudden sinkholes can occur around damaged structural drainage bricklines.'
          ]
        };
      case 'Streetlight':
        return {
          countryName, countryFlag,
          department: 'Municipal Electrical Department / State Electricity Distribution Company',
          phone: '1912',
          description: 'Maintains street light columns, overhead lines, and municipal distribution transformers.',
          websiteSearch: 'report streetlight failure electricity board complaint portal',
          instructions: [
            'Call the national electricity consumer helpline 1912 to report transformer sparks or loose overhead lines.',
            'Note down the light pole code (often painted or stenciled in yellow/black near the base).',
            'Avoid contact with any light pole or wet adjacent floor in high humidity or active rains.'
          ]
        };
      case 'Sanitation':
        return {
          countryName, countryFlag,
          department: 'Solid Waste Management (SWM) Division / Swachh Bharat Cleanliness Cell',
          phone: '1969',
          description: 'Clears illegal blackspots, overflows at garbage centers, and community bin garbage dumpings.',
          websiteSearch: 'report garbage dumping swachhata app municipal corporation',
          instructions: [
            'Submit a geotagged photo to the official central "Swachhata" application for 24-48h automated clearing.',
            'Notify your neighborhood SWM sanitary inspector for recurring unauthorized waste dumpings.',
            'For commercial debris dumping, report with vehicle license plate images to the local ward corporation.'
          ]
        };
      case 'Water':
        return {
          countryName, countryFlag,
          department: 'Drinking Water & Sewerage Board (e.g. BWSSB, DJB, MCGM Hydraulics)',
          phone: '1916',
          description: 'Repairs public water pipeline leaks, main line breaches, and contaminated tap water supply issues.',
          websiteSearch: 'water leakage pipe burst complaint water board civic portal',
          instructions: [
            'Report street water pipeline bursts or severe clean water waste to the Water Board emergency control office.',
            'Have your consumer water connection number (CAN/RR ID) handy for leaks close to property connection boundary lines.',
            'For dry spells or public standpost repairs, reach out to your local ward sub-station.'
          ]
        };
      case 'Public Safety':
        return {
          countryName, countryFlag,
          department: 'Police Non-Emergency Desk / Municipal Code Enforcement Ward',
          phone: '112',
          description: 'Handles pedestrian sidewalk blockages, hazardous building cracks, and municipal safety hazards.',
          websiteSearch: 'municipal corporation code enforcement public hazard encroachment',
          instructions: [
            'Call the Unified Emergency helpline 112 or local police precinct non-emergency line to report sidewalk obstructions.',
            'Submit reports about structural building cracks, wall collapses or open cellars to code enforcement.',
            'In immediate physical danger, dial 112 / 100 straight away.'
          ]
        };
      case 'Electrical':
        return {
          countryName, countryFlag,
          department: 'State Electricity Board Emergency Desk (e.g. BESCOM, MSEDCL, TANGEDCO)',
          phone: '1912',
          description: 'Handles dangling live high-voltage cables, transformer explosions, and smoking sub-stations.',
          websiteSearch: 'electricity board emergency live wire hazard reporting',
          instructions: [
            'Dial 1912 or emergency services 112 immediately for dangling cables or smoking electrical cabinets.',
            'Maintain a strict 10-meter clearance distance from any fallen overhead lines. Keep children and neighbors clear.',
            'Do not attempt to touch high voltage metallic structures with any handtools or wood.'
          ]
        };
      default:
        return {
          countryName, countryFlag,
          department: 'Ward Office / Local Corporator (Councillor) Office',
          phone: '1916',
          description: 'General civic complaints, local public issues coordination, and ward liaison support.',
          websiteSearch: 'contact local corporator ward office municipal corporation',
          instructions: [
            'Submit any custom civic complaint directly on your municipality\'s digital grievance box.',
            'Getting in touch with your local ward corporator (councillor) often speeds up issues requiring cross-department work.',
            'Use our Google Workspace tool to export a community petition to Google Docs to gather support signatures.'
          ]
        };
    }
  }

  if (country === 'belgium') {
    switch (category) {
      case 'Roads':
        return {
          countryName, countryFlag,
          department: 'Agentschap Wegen en Verkeer (AWV) / SPW Mobilité / FixMyStreet Brussels',
          phone: '1700',
          description: 'Responsible for public road network, structural asphalt potholes, and regional bicycle paths.',
          websiteSearch: 'report pothole meldpunt wegen en verkeer belgie online',
          instructions: [
            'In Brussels Capital Region, report pothole issues directly via the "Fix My Street Brussels" portal or app.',
            'For regional roads in Flanders, submit online on AWV’s "Meldpunt Wegen" or call 1700 (Flemish info line).',
            'For smaller municipal streets, use your local Commune/Gemeente website digital portal ("e-loket").'
          ]
        };
      case 'Drainage':
        return {
          countryName, countryFlag,
          department: 'Commune Technical Services / Regional Water Company (e.g. Vivaqua, Farys)',
          phone: '112',
          description: 'Clears clogged public storm grates, sewage backups, and manages road flash flood hazards.',
          websiteSearch: 'verstopte riolering straat melden gemeente belgie',
          instructions: [
            'Submit blocked road drains ("verstopte riolering") to the Technical Service desk of your local commune.',
            'If active road flooding poses an immediate hazard to traffic or private basements, dial 112 to alert the fire brigade.',
            'Avoid driving through deep water pools in tunnels or underpasses.'
          ]
        };
      case 'Streetlight':
        return {
          countryName, countryFlag,
          department: 'Electricity Grid Operator (e.g. Fluvius, Sibelga, ORES, Resa)',
          phone: '078353500',
          description: 'Handles burnt-out street lights, blackout stretches, and structurally damaged light poles.',
          websiteSearch: 'straatverlichting defect melden fluvius sibelga ores',
          instructions: [
            'Note the street name and the lamp-post ID number written on the blue/yellow sticker on the column.',
            'For Flanders, submit a repair request on "straatlampen.be" (Fluvius network operator hotline: 078 35 35 00).',
            'For Brussels, submit reports directly to Sibelga (sibelga.be) or via your municipal desk.'
          ]
        };
      case 'Sanitation':
        return {
          countryName, countryFlag,
          department: 'Waste Intercommunale (e.g. IVAGO, Net Brussel, Intradel) / Commune Environment Cell',
          phone: '115',
          description: 'Manages illegal waste dumping (sluikstort / dépôt sauvage) and overflowing community public bins.',
          websiteSearch: 'sluikstort melden afvaldienst intercommunale gemeente belgie',
          instructions: [
            'Report illegal dumping ("sluikstort" / "dépôt sauvage") directly on your commune\'s environment webpage.',
            'Sluikstorten is subject to severe administrative penalties (GAS-boetes / sanctions administratives) up to €500.',
            'Schedule bulk refuse ("grofvuil" / "encombrants") pickup directly with your local waste handler rather than leaving on curbs.'
          ]
        };
      case 'Water':
        return {
          countryName, countryFlag,
          department: 'Regional Water Corporation (e.g. De Watergroep, SWDE, Vivaqua, Water-link)',
          phone: '112',
          description: 'Repairs public water main breaks, leaking fire hydrants, and main supply pipeline leaks.',
          websiteSearch: 'waterlek openbare weg melden watermaatschappij belgie',
          instructions: [
            'Call the 24/7 emergency hotline of your regional water utility (find your local provider via postal code).',
            'If the leak causes active damage (such as undermining street asphalt or flooding basements), call 112 immediately.',
            'Keep neighbors informed if clean drinking water supplies are temporarily reduced for repair works.'
          ]
        };
      case 'Public Safety':
        return {
          countryName, countryFlag,
          department: 'Local Police Zone (Non-Emergency) / Commune Prevention Office',
          phone: '101',
          description: 'Handles public space obstructions, structural scaffolding hazards, and safety violations.',
          websiteSearch: 'politiezone niet dringende hulp melden belgie',
          instructions: [
            'Reach out to your local Police Zone non-emergency desk by dialing 101 or visiting their website.',
            'For sidewalk obstructions or safety hazards due to public trees, register a ticket with the local commune office.',
            'In a life-threatening scenario, always dial 112 immediately.'
          ]
        };
      case 'Electrical':
        return {
          countryName, countryFlag,
          department: 'Grid Network Operator Emergency Hotline (Fluvius / Sibelga / ORES)',
          phone: '080065065',
          description: 'Handles gas leaks, live electrical line hazards, and municipal transformer station sparks.',
          websiteSearch: 'gas geur stroomstoring noodnummer netbeheerder belgie',
          instructions: [
            'For urgent gas smells or major power cut issues in Flanders/Wallonia, call the grid emergency line on 0800 65 0 65.',
            'For Brussels grid electrical emergencies, contact Sibelga directly on 02 274 40 44.',
            'Stay well away from dangling wires and treat all blacked-out components as fully live.'
          ]
        };
      default:
        return {
          countryName, countryFlag,
          department: 'Local Town Hall (Stadhuis / Maison Communale) / e-Loket counter',
          phone: '1700',
          description: 'General municipal support, community inquiries, and citizen service administration.',
          websiteSearch: 'contact gemeentebestuur stadhuis e-loket diensten belgie',
          instructions: [
            'Submit any uncommon or general civic issue on your local city / municipality digital e-Loket.',
            'You can use our Google Workspace integrations to export a petition directly to Google Docs to present at your local council meeting.',
            'For administrative questions in Flanders, dial 1700 to reach Flemish central information operators.'
          ]
        };
    }
  }

  if (country === 'uk') {
    switch (category) {
      case 'Roads':
        return {
          countryName, countryFlag,
          department: 'Local Borough/County Council Highways Team / National Highways',
          phone: '03001235000',
          description: 'Handles road repairs, pavement potholes, broken signs, and traffic light outages on public roads.',
          websiteSearch: 'report pothole local council gov uk highways portal',
          instructions: [
            'Use the official gov.uk "Report a Pothole" online search to find your local council\'s exact reporting page.',
            'Alternatively, use the independent tool "FixMyStreet.com" to geolocate and submit the pothole report instantly.',
            'For problems on major motorways or trunk A-roads, contact National Highways directly on 0300 123 5000.'
          ]
        };
      case 'Drainage':
        return {
          countryName, countryFlag,
          department: 'Local Council Highways Maintenance / Regional Water Company',
          phone: '101',
          description: 'Clears blocked roadside gullies, storm sewer overflows, and manages road surface flooding.',
          websiteSearch: 'blocked road drain local council reporting uk',
          instructions: [
            'Local councils are responsible for roadside storm gullies. Log a ticket via their highways online portal.',
            'If the flood water is coming from a burst clean water main or sewer backup, contact your private regional water company.',
            'In case of dangerous flooding posing immediate structural threats, dial 999 for Fire & Rescue services.'
          ]
        };
      case 'Streetlight':
        return {
          countryName, countryFlag,
          department: 'Local Council Street Lighting Department',
          phone: '101',
          description: 'Maintains streetlights, pedestrian crossing lights, and illuminated traffic bollards.',
          websiteSearch: 'report faulty street light local council portal uk',
          instructions: [
            'Note the unique post reference number painted in black on the metal/concrete column at eye-level.',
            'Submit this column ID along with the street name directly on your local council\'s street lighting portal.',
            'For trunk roads and motorways, reports should be sent to National Highways.'
          ]
        };
      case 'Sanitation':
        return {
          countryName, countryFlag,
          department: 'Local Council Waste Management & Cleansing Division',
          phone: '101',
          description: 'Removes fly-tipping (illegal street waste), overflowing park bins, and public street litter.',
          websiteSearch: 'report fly tipping illegal dumping local council uk',
          instructions: [
            'Report illegal street dumping ("fly-tipping") directly on the local council portal or via the "Love Clean Streets" app.',
            'Fly-tipping is a major environmental offense in the UK and carries severe penalties and heavy court fines.',
            'For missed domestic wheelie bin collections, report online within 24 hours of your scheduled slot.'
          ]
        };
      case 'Water':
        return {
          countryName, countryFlag,
          department: 'Regional Private Water Utility (e.g. Thames Water, Severn Trent, Yorkshire Water)',
          phone: '101',
          description: 'Handles clean water pipe bursts, leaking street mains, and emergency water main failures.',
          websiteSearch: 'report water leak street main burst water company uk',
          instructions: [
            'Call your regional water company\'s free 24-hour leakline (lookup the supplier by postcode online if unsure).',
            'Supply the precise street name or "What3Words" coordinates to help the field engineers locate rural roadside leaks.',
            'Stay clear of rapidly spreading road sinkholes which can occur during high-pressure water main breaches.'
          ]
        };
      case 'Public Safety':
        return {
          countryName, countryFlag,
          department: 'Police Non-Emergency Desk / Local Council Code Enforcement',
          phone: '101',
          description: 'Handles blocked pathways, structural scaffolding hazards, anti-social safety issues, and street obstructions.',
          websiteSearch: 'police 101 non emergency report local council hazard uk',
          instructions: [
            'For non-emergency public hazards, dial the nationwide police hotline 101 or submit a digital report on their website.',
            'For dangerous overgrown pathways or trees touching phone lines, report via the council’s highways portal.',
            'In a high-risk situation or active threat to public life, always dial 999 directly.'
          ]
        };
      case 'Electrical':
        return {
          countryName, countryFlag,
          department: 'National Power Cut Helpline / District Network Operator (DNO)',
          phone: '105',
          description: 'Coordinates power grid failures, downed overhead wires, and damaged sub-stations.',
          websiteSearch: 'report downed power lines electricity distributor networks dno',
          instructions: [
            'Dial 105 immediately to report downed power lines, electrical sparks, or power outages. It connects to your local DNO.',
            'Stay at least 10 meters away from all down/hanging overhead cables—treat them as live and lethal.',
            'If you see fire or smoke coming from high voltage electrical units, dial 999 immediately.'
          ]
        };
      default:
        return {
          countryName, countryFlag,
          department: 'Local Council Citizens Office / Ward Councillor Liaison',
          phone: '101',
          description: 'General municipal issues, environmental services, and neighborhood affairs.',
          websiteSearch: 'contact local council ward councillor gov uk services',
          instructions: [
            'Find your local ward councillor online via gov.uk and contact them directly to support neighborhood initiatives.',
            'Use your council\'s central online customer service form to register complex multi-agency civic problems.',
            'Export your community petition easily to Google Docs to coordinate local borough actions.'
          ]
        };
    }
  }

  if (country === 'canada') {
    switch (category) {
      case 'Roads':
        return {
          countryName, countryFlag,
          department: 'Municipal Public Works Dept / City Road Maintenance Office',
          phone: '311',
          description: 'Fills public potholes, clears road debris, and manages damaged traffic signs.',
          websiteSearch: 'report pothole city 311 portal road maintenance canada',
          instructions: [
            'Call 311 or use your city’s 311 app (e.g. Toronto 311, Calgary 311, Van311) to log road damage.',
            'State the direction of travel and the nearest cross street or building address to locate the pothole.',
            'During winter, report urgent snow accumulation or icy patches directly on the municipal plow tracker portal.'
          ]
        };
      case 'Drainage':
        return {
          countryName, countryFlag,
          department: 'City Water & Stormwater Management Division',
          phone: '311',
          description: 'Clears blocked catch basins, roadside gutters, and prevents residential block flooding.',
          websiteSearch: 'stormwater drainage overflow sewer blocking city portal canada',
          instructions: [
            'Report blocked road storm grates or catch basins via 311 to prevent localized block flooding.',
            'Do not attempt to clear heavy cast-iron storm grates or enter swollen ditches yourself.',
            'For storm drain issues on major regional highways, report to the provincial Ministry of Transportation.'
          ]
        };
      case 'Streetlight':
        return {
          countryName, countryFlag,
          department: 'Local Power Utility (e.g. Toronto Hydro, BC Hydro, Hydro-Québec) / Street Lighting Division',
          phone: '311',
          description: 'Handles burnt-out street lamps, darkened streets, and physically damaged light poles.',
          websiteSearch: 'report streetlight outage power utility service link canada',
          instructions: [
            'Locate the street light pole number usually stamped onto a small metal label at eye-level.',
            'Submit the pole ID directly to your city’s designated energy distributor (e.g., Toronto Hydro or BC Hydro).',
            'If the pole has been knocked down by a vehicle, stay clear and call the city utility emergency line.'
          ]
        };
      case 'Sanitation':
        return {
          countryName, countryFlag,
          department: 'City Solid Waste Management / Bylaw Enforcement',
          phone: '311',
          description: 'Cleans up illegal dumping, overflowing public park bins, and illegal roadside litter.',
          websiteSearch: 'report illegal dumping waste management city 311 canada',
          instructions: [
            'Report illegal garbage dumping on public property or overflowing garbage pins directly to 311 waste services.',
            'Municipal bylaw enforcement can fine illegal dumpers starting from $500 up to several thousand dollars.',
            'Report missed household blue/black/green bin collections via the city’s digital garbage calendar.'
          ]
        };
      case 'Water':
        return {
          countryName, countryFlag,
          department: 'Municipal Water & Wastewater Services Agency',
          phone: '311',
          description: 'Repairs public water main breaks, leaking fire hydrants, and municipal clean water lines.',
          websiteSearch: 'water emergency main break report city utility service canada',
          instructions: [
            'Report suspected underground pipe leaks (water pooling on road during dry days) to the city Water Desk on 311.',
            'In case of gushing hydrants, report the hydrant code/address immediately to the municipal water operations dispatcher.',
            'For immediate property flooding threats due to main breaks, call the 24/7 water emergency hotline.'
          ]
        };
      case 'Public Safety':
        return {
          countryName, countryFlag,
          department: 'Police Non-Emergency Dispatch / City Bylaw Enforcement',
          phone: '311',
          description: 'Handles public roadway blockages, dangerous park structures, and structural code violations.',
          websiteSearch: 'bylaw enforcement officer non emergency hazard report canada',
          instructions: [
            'For non-emergency community issues, call your local police department’s designated 10-digit line.',
            'For sidewalk obstructions, illegal parking, or municipal bylaws, contact City Bylaw Officers via 311.',
            'In any high-risk or life-threatening situation, immediately call 911.'
          ]
        };
      case 'Electrical':
        return {
          countryName, countryFlag,
          department: 'Provincial/Local Electrical Grid Operator (e.g. Hydro One, BC Hydro, Epcor)',
          phone: '911',
          description: 'Handles downed power lines, sparking overhead lines, and municipal grid failures.',
          websiteSearch: 'report downed power lines electricity distributor emergency canada',
          instructions: [
            'Call 911 immediately if you spot a downed or sagging electrical power cable. Keep at least 10 meters away.',
            'Treat every fallen line as live, highly dangerous, and fully energized.',
            'For non-urgent outages, call your local utility (e.g. Hydro One at 1-800-434-1235) to report.'
          ]
        };
      default:
        return {
          countryName, countryFlag,
          department: 'City Council / Mayor\'s Community Support Office',
          phone: '311',
          description: 'General civic complaints, neighborhood initiatives, and regional councillor desks.',
          websiteSearch: 'contact local city councillor office municipality service canada',
          instructions: [
            'Use the 311 registry to find which local council department handles uncommon or complex civic requests.',
            'Contact your local City Councillor’s office directly to raise long-standing community concerns.',
            'Export your civic petition to Google Docs to collect local signatures and emails easily.'
          ]
        };
    }
  }

  if (country === 'australia') {
    switch (category) {
      case 'Roads':
        return {
          countryName, countryFlag,
          department: 'Local Government Council (LGA) Highways Dept / State Roads Authority (e.g. Transport for NSW, VicRoads)',
          phone: '131170',
          description: 'Responsible for localized road potholes, failing street asphalt, missing signs, and state highway grids.',
          websiteSearch: 'report pothole local council roads authority australia',
          instructions: [
            'Use the smartphone app "Snap Send Solve" to easily photo-report road defects to your local LGA council.',
            'For state-controlled highways, report road hazards directly to the state traffic management center (e.g., NSW on 131 170).',
            'Supply nearest cross-streets, landmarks, or street numbers to speed up repair team dispatch.'
          ]
        };
      case 'Drainage':
        return {
          countryName, countryFlag,
          department: 'Local LGA Council Engineering Division / Regional Water Corporation',
          phone: '131444',
          description: 'Handles street stormwater drains, clearing blocked roadside gutters, and stormwater flooding.',
          websiteSearch: 'blocked stormwater drain road flooding local council australia',
          instructions: [
            'LGA councils manage street storm grates. File reports of silt or leaf-clogged gutters via council website forms.',
            'For burst public sewers causing local pollution, contact water corporations (e.g., Melbourne Water or Sydney Water).',
            'For urgent stormwater flood assistance threatening properties, contact the State Emergency Service (SES) on 132 500.'
          ]
        };
      case 'Streetlight':
        return {
          countryName, countryFlag,
          department: 'Electricity Distributor Network (e.g. Ausgrid, Endeavour Energy, Jemena, Energex, Powercor)',
          phone: '131444',
          description: 'Handles broken street lamps, dark streets, flickering lights, and physical pole damage.',
          websiteSearch: 'report street light failure out network distributor ausgrid endeavour',
          instructions: [
            'Streetlights are usually owned by grid distribution networks rather than local councils.',
            'Identify your local network distributor (check energy bill or postcode lookups) and report the light out on their online forms.',
            'Provide the specific street address and, if safe to check, the pole ID stamped near the eye-level.'
          ]
        };
      case 'Sanitation':
        return {
          countryName, countryFlag,
          department: 'Local LGA Council Waste and Cleaning Desk',
          phone: '131444',
          description: 'Cleans up illegal rubbish dumping on public land, overflowing park bins, and public street waste.',
          websiteSearch: 'report illegal dumping rubbish local lga council australia',
          instructions: [
            'Report illegal street dumping or overflowing public bins using council online reporting pages or "Snap Send Solve".',
            'Heavy fines are issued by local council rangers and environmental protection authorities for dumping trash in parks.',
            'For missed domestic waste or recycling bin collections, submit an online request to your LGA council desk.'
          ]
        };
      case 'Water':
        return {
          countryName, countryFlag,
          department: 'Regional Water Utility Board (e.g. Sydney Water, SA Water, Queensland Urban Utilities)',
          phone: '131444',
          description: 'Handles street pipe bursts, gushing fire hydrants, major water pressure drops, and sewer main emergencies.',
          websiteSearch: 'report water main burst pipe leak water utility australia',
          instructions: [
            'Contact your regional water authority emergency desk directly (e.g., Sydney Water on 13 20 90, Melbourne Water on 131 722).',
            'Provide accurate cross-streets or "What3Words" coordinates to help the field crew locate rural leaks.',
            'Maintain a wide safety distance from major main bursts, as high-pressure water can cause sudden sinkholes.'
          ]
        };
      case 'Public Safety':
        return {
          countryName, countryFlag,
          department: 'Police Assistance Line (Non-Emergency) / Local Council Rangers',
          phone: '131444',
          description: 'Handles anti-social hazards, pathway blocks, dangerous overgrown park trees, and local municipal bylaws.',
          websiteSearch: 'police non emergency local council rangers hazard australia',
          instructions: [
            'Contact the Police Assistance Line on 131 444 for non-emergency public hazards or police assistance.',
            'For local park tree issues or sidewalk blocks, contact your council rangers or submit a ticket on council e-services.',
            'In a dangerous emergency or immediate threat, dial Triple Zero (000) immediately.'
          ]
        };
      case 'Electrical':
        return {
          countryName, countryFlag,
          department: 'Electrical Grid Network Operator / State Fire Emergency Services',
          phone: '000',
          description: 'Manages live electrical wires, sparking transformers, major power cut risks, and grid faults.',
          websiteSearch: 'report downed power lines electricity distributor network emergency australia',
          instructions: [
            'Call Triple Zero (000) immediately if you see a fallen or hanging power line. Keep at least 15 meters away.',
            'Never approach wet ground, metal fences, or vehicles in contact with electrical cables.',
            'Report non-emergency street pole faults or power cuts to your distributor’s emergency service hotline.'
          ]
        };
      default:
        return {
          countryName, countryFlag,
          department: 'Local Council Administration / LGA Representative Desk',
          phone: '131444',
          description: 'General LGA council complaints, community initiatives, and council ward officers.',
          websiteSearch: 'contact local council lga administration public service australia',
          instructions: [
            'Call your local LGA council customer helpline to find which civic agency coordinates custom requests.',
            'You can lobby your ward councillor or contact local representatives to raise recurring neighborhood infrastructure issues.',
            'Export your ward petition to Google Docs to gather community signatures for formal LGA submission.'
          ]
        };
    }
  }

  if (country === 'germany') {
    switch (category) {
      case 'Roads':
        return {
          countryName, countryFlag,
          department: 'Tiefbauamt / Straßenbauamt der Stadt / Mängelmelder',
          phone: '115',
          description: 'Responsible for road surfaces, pavement potholes, failing pavement tiles, and municipal street signs.',
          websiteSearch: 'schlagloch melden stadt maengelmelder tiefbauamt',
          instructions: [
            'Most German cities have an online portal "Mängelmelder" or "Sag’s uns" to log road damages.',
            'Specify the exact street and nearest house number (Hausnummer) to guide road engineers.',
            'For Autobahn highway damages, report directly to "Autobahn GmbH".'
          ]
        };
      case 'Drainage':
        return {
          countryName, countryFlag,
          department: 'Stadtentwässerungsamt / Tiefbauamt der Stadt',
          phone: '115',
          description: 'Responsible for blocked street storm grates, culvert silting, and waterlogged public areas.',
          websiteSearch: 'gulli verstopft strassenueberschwemmung melden stadt',
          instructions: [
            'Report blocked street drains ("Gulli verstopft") to the local municipal engineering desk or Stadtwerke.',
            'If active stormwater is flooding basements or causing dangerous street flows, dial 112 for the non-emergency fire service.',
            'Never try to open heavy metal sewer grids on your own.'
          ]
        };
      case 'Streetlight':
        return {
          countryName, countryFlag,
          department: 'Örtliche Stadtwerke / Stromnetzbetreiber',
          phone: '115',
          description: 'Handles non-functional streetlights, broken light posts, and dark public walk alleys.',
          websiteSearch: 'strassenbeleuchtung defekt stoerung melden stadtwerke',
          instructions: [
            'Find the lamp pole label near eye level showing the specific light identifier (Leuchtennummer).',
            'Log the issue directly with the municipal utilities ("Stadtwerke") of your city.',
            'In case of immediate danger, like open live wire access doors, call the grid provider\'s direct line.'
          ]
        };
      case 'Sanitation':
        return {
          countryName, countryFlag,
          department: 'Stadtreinigung / Ordnungsamt der Gemeinde',
          phone: '115',
          description: 'Manages illegal garbage dumping (wilder Müll) and overflowing street bins.',
          websiteSearch: 'wilder muell ablagern melden ordnungsamt stadt',
          instructions: [
            'Report illegal garbage heaps ("wilder Müll" or "Müllablagerung") directly on the local Ordnungsamt online form.',
            'The Ordnungsamt issues hefty environmental administrative fines starting from €100 for littering.',
            'Report missed household wheelie bins to the municipal trash disposal department.'
          ]
        };
      case 'Water':
        return {
          countryName, countryFlag,
          department: 'Lokale Wasserwerke / Kundenservice der Stadtwerke',
          phone: '115',
          description: 'Handles clean drinking water pipe breaks, leaking street hydrants, and municipal main line failures.',
          websiteSearch: 'wasserrohrbruch strasse stoerung melden wasserwerke',
          instructions: [
            'Report street water pipeline bursts ("Wasserrohrbruch") to the local Wasserwerke 24h hotline immediately.',
            'Keep away from active road sinkings or washouts near water pipeline leaks.',
            'For major threat flooding in adjacent properties, call fire rescue services on 112.'
          ]
        };
      case 'Public Safety':
        return {
          countryName, countryFlag,
          department: 'Ordnungsamt / Bürgeramt der Stadt',
          phone: '115',
          description: 'Handles sidewalk blocks, dangerous hanging tree limbs, and general public code hazards.',
          websiteSearch: 'ordnungsamt meldeportal gefahrenstelle meldung',
          instructions: [
            'Contact the local "Ordnungsamt" via their online counter or central helpline to register obstructions.',
            'Overgrown branches over hanging paths should be addressed with the parks division (Grünflächenamt).',
            'In immediate crisis scenarios, dial police at 110 or emergency services at 112.'
          ]
        };
      case 'Electrical':
        return {
          countryName, countryFlag,
          department: 'Verteilnetzbetreiber / Stromnetz Notdienst',
          phone: '112',
          description: 'Handles live overhead power faults, smoking transformers, and local power cut emergencies.',
          websiteSearch: 'stromausfall leitung beschaedigt stoerung netzbetreiber',
          instructions: [
            'Contact your localized power grid distributor emergency desk immediately. Dial 112 for fire hazard responders.',
            'Always maintain a 10-meter wide clearance circle from any fallen electrical wires.',
            'Never touch wet floorings or metal fences near sparking power columns.'
          ]
        };
      default:
        return {
          countryName, countryFlag,
          department: 'Bürgeramt / Stadtverwaltung',
          phone: '115',
          description: 'General citizen support, local public affairs, and municipal administration.',
          websiteSearch: 'stadtverwaltung kontakt buergerbuero stoerungsmelder',
          instructions: [
            'Use the unified municipal number 115 to find the exact agency coordinating custom civic requests.',
            'Raising long-term infrastructure defects with your Bezirksamt (district office) often speeds up structural fixes.',
            'Use our Google Workspace tool to export a community petition to Google Docs to gather support signatures.'
          ]
        };
    }
  }

  // Fallback (US/Canada / general)
  const categoryKey = (AUTHORITY_CONTACTS_FALLBACK[category] ? category : 'Other') as keyof typeof AUTHORITY_CONTACTS_FALLBACK;
  const fallback = AUTHORITY_CONTACTS_FALLBACK[categoryKey];
  return {
    countryName: 'United States',
    countryFlag: '🇺🇸',
    department: fallback.department,
    phone: fallback.phone,
    description: fallback.description,
    websiteSearch: fallback.websiteSearch,
    instructions: fallback.instructions
  };
}

export default function IssueDetailModal({
  issue,
  recentIssues = [],
  onUpdateIssue,
  onAddCommentLocal,
  currentUserProfile,
  handleToggleEmergencyAttention,
  onClose,
  currentUser,
  accessToken,
  onSelectMapLocation,
  comments,
  newComment,
  setNewComment,
  handleSubmitComment,
  isAiLoading,
  hasUpvoted = false,
  handleUpvote,
  handleVerifyEyewitness,
  handleAmplify,
  isAmplifying,
  amplifiedMessage,
  isResolving,
  setIsResolving,
  handleResolveProofUpload,
  resolveMedia,
  handleVerifyResolution,
  isVerifyingFix,
  fixVerdict,
  generateICSFile,
  isWorkspaceActionLoading,
  workspaceActionFeedback,
  workspaceActionLink,
  workspaceActionError,
  chatSpaces,
  isChatSpacesLoading,
  selectedSpaceName,
  setSelectedSpaceName,
  handleSendChatAlert,
  handleSaveKeepNote,
  handleExportToDocs,
  handleExportToSheets,
  handleScheduleCalendar,
  handleCreateTask,
  fileInputRef
}: IssueDetailModalProps) {

  // Local States for AI and Google Workspace Interactions
  const [sliderPosition, setSliderPosition] = React.useState<number>(50);

  // Dynamic live-search authority contact state
  const [authorityContact, setAuthorityContact] = React.useState<any | null>(null);
  const [loadingContact, setLoadingContact] = React.useState<boolean>(true);

  React.useEffect(() => {
    let active = true;
    const fetchContact = async () => {
      setLoadingContact(true);
      try {
        const response = await fetch('/api/get-authority-contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: issue.category, address: issue.address })
        });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        if (active) {
          setAuthorityContact(data);
        }
      } catch (err) {
        console.error('Failed to fetch dynamic authority contact:', err);
        // Fallback to our client-side fallback if fetch fails or is unconfigured
        const fallback = getDynamicContactForIssue(issue.category, issue.address);
        if (active) {
          setAuthorityContact(fallback);
        }
      } finally {
        if (active) {
          setLoadingContact(false);
        }
      }
    };

    fetchContact();
    return () => {
      active = false;
    };
  }, [issue.id, issue.category, issue.address]);

  // Share states
  const [shareFeedback, setShareFeedback] = React.useState<string | null>(null);
  const [shareError, setShareError] = React.useState<string | null>(null);

  const handleShareIssue = async () => {
    setShareFeedback(null);
    setShareError(null);
    const shareData = {
      title: `Civic Alert: ${issue.title}`,
      text: `🚨 Community concern reported: "${issue.title}" at ${issue.address || 'our neighborhood'}. Severity: ${issue.severity}. Help us verify and resolve this!`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShareFeedback("Successfully shared!");
        setTimeout(() => setShareFeedback(null), 3000);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return; // User cancelled sharing
        }
        console.warn("Web Share API failed, falling back to clipboard:", err);
        fallbackCopyToClipboard(shareData);
      }
    } else {
      fallbackCopyToClipboard(shareData);
    }
  };

  const fallbackCopyToClipboard = async (shareData: { title: string; text: string; url: string }) => {
    try {
      const fullText = `${shareData.title}\n\n${shareData.text}\n\nLink: ${shareData.url}`;
      await navigator.clipboard.writeText(fullText);
      setShareFeedback("Copied issue details & link to clipboard!");
      setTimeout(() => setShareFeedback(null), 4000);
    } catch (err: any) {
      console.error("Clipboard copy failed:", err);
      setShareError("Could not share or copy link.");
      setTimeout(() => setShareError(null), 4000);
    }
  };

  // 1. Petition Drafter local states
  const [petitionText, setPetitionText] = React.useState<string>('');
  const [isDrafting, setIsDrafting] = React.useState<boolean>(false);
  const [isExportingPetition, setIsExportingPetition] = React.useState<boolean>(false);
  const [exportedPetitionUrl, setExportedPetitionUrl] = React.useState<string | null>(null);
  const [petitionError, setPetitionError] = React.useState<string | null>(null);

  // 2. Google Meet Rally Scheduler local states
  const [meetingDateTime, setMeetingDateTime] = React.useState<string>(() => {
    // Default to tomorrow at 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(tomorrow.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  });
  const [meetingNotes, setMeetingNotes] = React.useState<string>(
    `Agenda:\n1. Introduce the "${issue.title}" safety concern.\n2. Review visual media evidence & AI Impact analysis.\n3. Vote on sending our formal community petition doc.\n4. Allocate local repair work & coordinate ward follow-up.`
  );
  const [isSchedulingMeet, setIsSchedulingMeet] = React.useState<boolean>(false);
  const [scheduledMeetResult, setScheduledMeetResult] = React.useState<{ eventLink: string; meetLink: string } | null>(null);
  const [meetError, setMeetError] = React.useState<string | null>(null);

  const handleDraftPetition = async () => {
    setIsDrafting(true);
    setPetitionError(null);
    setExportedPetitionUrl(null);
    try {
      const response = await fetch('/api/draft-petition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: issue.title,
          category: issue.category,
          summary: issue.summary,
          recommended_action: issue.recommended_action,
          severity: issue.severity,
          address: issue.address
        })
      });
      if (!response.ok) throw new Error('Failed to generate petition draft');
      const data = await response.json();
      setPetitionText(data.petitionText);
    } catch (err: any) {
      setPetitionError(err.message || 'Error drafting community petition');
    } finally {
      setIsDrafting(false);
    }
  };

  const handleExportPetitionDoc = async () => {
    if (!accessToken) return;
    setIsExportingPetition(true);
    setPetitionError(null);
    try {
      const docUrl = await exportPetitionToDocs(accessToken, issue, petitionText);
      setExportedPetitionUrl(docUrl);
    } catch (err: any) {
      setPetitionError(err.message || 'Failed to export petition to Google Docs');
    } finally {
      setIsExportingPetition(false);
    }
  };

  const handleScheduleCommunityMeetAction = async () => {
    if (!accessToken) return;
    setIsSchedulingMeet(true);
    setMeetError(null);
    try {
      const result = await scheduleCommunityMeet(accessToken, issue, meetingDateTime, meetingNotes);
      setScheduledMeetResult(result);
    } catch (err: any) {
      setMeetError(err.message || 'Failed to schedule community rally meeting');
    } finally {
      setIsSchedulingMeet(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Low': return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
      case 'Medium': return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      case 'High': return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      case 'Critical': return 'bg-rose-500/10 text-rose-700 border-rose-500/20 animate-pulse';
      default: return 'bg-slate-500/10 text-slate-600';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Reported': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Resolved': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Deprecated': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-beach-driftwood/40 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md mx-auto bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-slide-up shadow-2xl border border-beach-cream"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b border-beach-cream/60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSeverityColor(issue.severity)}`}>
              {issue.severity} Severity
            </span>
            {issue.urgency && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                issue.urgency === 'Immediate' 
                  ? 'bg-rose-500/10 text-rose-700 border-rose-500/20' 
                  : issue.urgency === 'High' 
                    ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' 
                    : issue.urgency === 'Medium' 
                      ? 'bg-sky-500/10 text-sky-700 border-sky-500/20' 
                      : 'bg-slate-500/10 text-slate-700 border-slate-500/20'
              }`}>
                {issue.urgency} Urgency
              </span>
            )}
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-beach-cream/80 px-2 py-0.5 rounded-md">
              {issue.category}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeColor(issue.status)}`}>
              {issue.status}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleShareIssue}
              className="p-1.5 hover:bg-beach-cream rounded-full transition-all text-slate-400 hover:text-beach-coral"
              title="Share Issue"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-beach-cream rounded-full transition-all text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Share feedback toast */}
        {shareFeedback && (
          <div className="bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between gap-2 animate-fade-in border-b border-emerald-600">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{shareFeedback}</span>
            </div>
            <button onClick={() => setShareFeedback(null)} className="text-white/80 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {shareError && (
          <div className="bg-rose-500 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between gap-2 animate-fade-in border-b border-rose-600">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <span>{shareError}</span>
            </div>
            <button onClick={() => setShareError(null)} className="text-white/80 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {/* Media Slider / Image Showcase */}
          {issue.mediaUrls && issue.mediaUrls.length > 0 && (
            <div className="rounded-2xl overflow-hidden relative border border-beach-cream bg-slate-50">
              {issue.mediaUrls.length > 1 ? (
                <div className="relative h-60 w-full select-none overflow-hidden group">
                  {/* Before Image (Original) */}
                  <img 
                    src={issue.mediaUrls[0]} 
                    alt="Before fix" 
                    className="absolute inset-0 w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2 left-2 z-20 bg-rose-600/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[9px] font-bold text-white uppercase tracking-wider shadow-sm">
                    Before (Hazard Report)
                  </div>

                  {/* After Image Container (Dynamic width clipped by slider) */}
                  <div 
                    className="absolute inset-0 overflow-hidden border-r-2 border-white z-10 shadow-2xl"
                    style={{ width: `${sliderPosition}%` }}
                  >
                    <img 
                      src={issue.mediaUrls[issue.mediaUrls.length - 1]} 
                      alt="After fix" 
                      className="absolute inset-0 w-full h-full object-cover" 
                      style={{ width: '100%', maxWidth: 'none', height: '100%' }}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 left-2 z-20 bg-emerald-600/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[9px] font-bold text-white uppercase tracking-wider shadow-sm whitespace-nowrap">
                      After (Verified Resolution)
                    </div>
                  </div>

                  {/* Vertical Divider / Slider Line Handle */}
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-xl cursor-ew-resize z-30 pointer-events-none"
                    style={{ left: `${sliderPosition}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white border border-slate-200 rounded-full shadow-lg flex items-center justify-center text-slate-600 hover:scale-105 active:scale-95 transition-all">
                      <span className="text-sm font-black font-mono leading-none">↔</span>
                    </div>
                  </div>

                  {/* Range Input Overlay to handle drag gestures */}
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={sliderPosition} 
                    onChange={(e) => setSliderPosition(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-40"
                  />
                </div>
              ) : (
                <img 
                  src={issue.mediaUrls[0]} 
                  alt={issue.title} 
                  className="w-full h-48 object-cover hover:scale-[1.02] transition-transform duration-300" 
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          )}

          {/* Title and Address Location Selector */}
          <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
            <h2 className="text-base font-bold text-beach-driftwood leading-snug">{issue.title}</h2>
            <button
              onClick={() => {
                if (onSelectMapLocation) {
                  onSelectMapLocation(issue.lat, issue.lng);
                }
                onClose();
              }}
              className="text-xs text-beach-ocean hover:underline flex items-center gap-1 mt-1.5 font-semibold text-left"
            >
              <MapPin className="w-3.5 h-3.5 shrink-0 text-beach-coral" /> 
              <span>{issue.address || 'Address unavailable'} (Go to Map)</span>
            </button>
          </div>

          {/* Timeline Stepper */}
          <div className="bg-beach-cream/20 p-3.5 rounded-2xl border border-beach-cream/50">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Civic Case Lifecycle</h4>
            <div className="relative pl-5 border-l border-beach-cream/85 space-y-3.5">
              <div className="relative">
                <div className="absolute -left-[25px] w-3 h-3 bg-beach-coral rounded-full border-2 border-white shadow-sm" />
                <p className="text-xs font-bold text-beach-driftwood">Issue Reported</p>
                <p className="text-[10px] text-slate-500 font-medium">Captured and saved locally</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[25px] w-3 h-3 bg-beach-coral rounded-full border-2 border-white shadow-sm" />
                <p className="text-xs font-bold text-beach-driftwood">AI Analyzed</p>
                <p className="text-[10px] text-slate-500 font-medium leading-normal">
                  Classified as {issue.category}. Severity choice: {issue.severity_reason || 'AI automated assessment'}
                </p>
              </div>
              <div className="relative">
                <div className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 border-white shadow-sm ${issue.verification_count > 0 ? 'bg-beach-coral animate-pulse' : 'bg-slate-300'}`} />
                <p className="text-xs font-bold text-beach-driftwood">Community Verified ({issue.verification_count} +1s)</p>
                <p className="text-[10px] text-slate-500 font-medium">Citizen eyewitness validations</p>
              </div>
              <div className="relative">
                <div className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 border-white shadow-sm ${issue.status === 'Resolved' ? 'bg-beach-coral' : 'bg-slate-300'}`} />
                <p className="text-xs font-bold text-beach-driftwood">Fix Verified</p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {issue.status === 'Resolved' ? 'Resolved via dual before/after proof!' : 'Awaiting community resolution proof'}
                </p>
              </div>
            </div>
          </div>

          {/* AI generated Impact analysis and Summary */}
          <div className="bg-beach-cream/10 border border-beach-cream p-3.5 rounded-2xl space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-beach-coral" />
              <h4 className="text-xs font-bold text-beach-driftwood">AI Assessment & Summary</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{issue.summary || 'Analyzing case factors...'}</p>
          </div>

          {/* Recommended actions (Who can help / AI advice) */}
          <div className="bg-sky-500/5 border border-sky-500/10 p-3.5 rounded-2xl">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-beach-ocean" />
              <h4 className="text-xs font-bold text-beach-ocean">Recommended Action Advice</h4>
            </div>
            <p className="text-xs text-sky-800 mt-1 leading-relaxed">{issue.recommended_action || 'Avoid the hazard site and await municipal service response.'}</p>
          </div>

          {/* Civic Authority & Fix Contacts Section */}
          {(() => {
            if (loadingContact || !authorityContact) {
              return (
                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl space-y-3 animate-pulse">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-slate-400" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-700">How to Contact Authorities for Fixes</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Gemini Live Search Grounding locating public contacts...</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-200 rounded w-full"></div>
                    <div className="h-3 bg-slate-200 rounded w-4/5"></div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <div className="flex-1 h-8 bg-slate-200 rounded-xl"></div>
                    <div className="flex-1 h-8 bg-slate-200 rounded-xl"></div>
                  </div>
                </div>
              );
            }

            const contactInfo = authorityContact;
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${contactInfo.websiteSearch} ${issue.address || 'near me'}`)}`;
            
            return (
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-500" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">How to Contact Authorities for Fixes</h4>
                      <p className="text-[10px] text-slate-400 font-medium">Refer to this section for civil resolution & direct report channels</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-200/60 px-2 py-0.5 rounded-full border border-slate-300/40" title="Detected Jurisdiction">
                    <span className="text-xs">{contactInfo.countryFlag}</span>
                    <span className="text-[9px] font-bold text-slate-600">{contactInfo.countryName}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Target Agency</span>
                    <span className="text-[10px] bg-slate-200/70 text-slate-700 px-2 py-0.5 font-bold rounded">
                      {issue.category} Division
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 leading-snug">{contactInfo.department}</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{contactInfo.description}</p>
                </div>

                {/* Call & Web search actions */}
                <div className="flex gap-2 pt-1">
                  <a
                    href={`tel:${contactInfo.phone}`}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-300" />
                    <span>Call Hotline ({contactInfo.phone})</span>
                  </a>
                  
                  <a
                    href={searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[10px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                    <span>Search City Portal</span>
                  </a>
                </div>

                {/* Custom Action Tips */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 space-y-1.5">
                  <span className="text-[9px] uppercase font-extrabold tracking-wider text-slate-500 block">Civil Resolution Steps:</span>
                  <ul className="list-disc list-inside text-[10px] text-slate-600 space-y-1 pl-1">
                    {(contactInfo.instructions || []).map((inst: string, index: number) => (
                      <li key={index} className="leading-relaxed">
                        <span className="font-medium text-slate-700">{inst}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })()}

          {/* Priority Emergency Attention block */}
          {(() => {
            const emergencyCount = issue.emergencyFlaggedBy?.length || 0;
            const isEmergencyFlaggedByMe = currentUser && issue.emergencyFlaggedBy?.includes(currentUser.uid);
            const tokensLeft = currentUserProfile?.emergencyAttentionsLeft ?? 3;
            
            return (
              <div className="bg-rose-500/5 border border-rose-500/15 p-3.5 rounded-2xl flex flex-col gap-2.5 text-left">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🚨</span>
                    <div>
                      <h4 className="text-xs font-bold text-rose-800">Priority Emergency Attention</h4>
                      <p className="text-[10px] text-slate-500 leading-normal">Flag matters requiring immediate focus. Goes first in algorithm!</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20 whitespace-nowrap">
                      {tokensLeft} / 3 tokens
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => handleToggleEmergencyAttention && handleToggleEmergencyAttention(issue)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                    isEmergencyFlaggedByMe
                      ? 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-600'
                      : 'bg-white hover:bg-rose-50/50 text-rose-700 border border-rose-500/30'
                  }`}
                >
                  <span>{isEmergencyFlaggedByMe ? 'Retract Emergency Flag' : 'Flag as Emergency Attention'}</span>
                  <span className="bg-rose-500/10 px-1.5 py-0.5 rounded text-[10px] text-rose-700 font-bold border border-rose-500/20">
                    {emergencyCount} flagged
                  </span>
                </button>
              </div>
            );
          })()}

          {/* Upvote & Verification buttons row */}
          <div className="flex gap-2.5">
            <button
              onClick={(e) => handleUpvote(issue, e)}
              className={`flex-1 py-2.5 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                hasUpvoted
                  ? 'bg-beach-coral/10 text-beach-coral border-beach-coral/30'
                  : 'bg-beach-cream/40 text-beach-driftwood border-beach-cream/80 hover:bg-beach-cream/70'
              }`}
            >
              <ThumbsUp className={`w-4 h-4 ${hasUpvoted ? 'fill-beach-coral text-beach-coral' : 'text-beach-coral'}`} /> 
              <span>{hasUpvoted ? 'Upvoted' : 'Upvote'} ({issue.upvotes || 0})</span>
            </button>
            <button
              onClick={(e) => handleVerifyEyewitness(issue, e)}
              className="flex-1 py-2.5 bg-beach-coral hover:bg-beach-coral/90 text-white text-xs font-bold flex items-center justify-center gap-1.5 rounded-xl transition-all shadow-md"
            >
              <CheckCircle className="w-4 h-4" /> 
              <span>Confirm Eyewitness</span>
            </button>
            <button
              onClick={handleShareIssue}
              className="px-4 py-2.5 border border-beach-cream bg-white hover:bg-beach-cream/20 text-slate-600 hover:text-beach-coral rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Share Issue"
            >
              <Share2 className="w-4 h-4 text-beach-coral" />
              <span>Share</span>
            </button>
          </div>

          {/* Amplify Escalation section */}
          {(issue.severity === 'Critical' || (issue.upvotes || 0) >= 10 || issue.verification_count >= 5) && (
            <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <Award className="text-beach-sun w-5 h-5 animate-bounce" />
                <div>
                  <h4 className="text-xs font-bold text-amber-800">Amplify Civic Action Needed!</h4>
                  <p className="text-[10px] text-slate-500">This issue has received major community backing. Generate pre-filled public notifications.</p>
                </div>
              </div>
              <button
                onClick={() => handleAmplify(issue)}
                disabled={isAmplifying}
                className="w-full py-2 bg-beach-sun hover:bg-beach-sun/90 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Share2 className="w-4 h-4" /> {isAmplifying ? 'Drafting notification...' : 'Draft Civic Escalation Message'}
              </button>

              {/* Share Intents panel */}
              {amplifiedMessage && (
                <div className="space-y-2 pt-2 border-t border-beach-cream animate-fade-in">
                  <p className="text-xs bg-white p-2.5 rounded-lg text-slate-600 border border-beach-cream italic text-left">
                    "{amplifiedMessage}"
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(amplifiedMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-sm"
                    >
                      WhatsApp
                    </a>
                    <a
                      href={`mailto:?subject=Urgent Civic Fix&body=${encodeURIComponent(amplifiedMessage)}`}
                      className="flex-1 text-center py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-bold shadow-sm"
                    >
                      Email Lead
                    </a>
                    <a
                      href={`https://x.com/intent/tweet?text=${encodeURIComponent(amplifiedMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold shadow-sm"
                    >
                      X / Tweet
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mark fixed / Evidence proof upload */}
          {issue.status !== 'Resolved' && (
            <div className="bg-beach-cream/20 p-3.5 rounded-2xl border border-beach-cream/50">
              <h4 className="text-xs font-bold text-beach-driftwood flex items-center gap-1.5">
                <HeartHandshake className="text-beach-coral w-4 h-4" /> Resolve & Verify Fix
              </h4>
              <p className="text-[10px] text-slate-500 mt-1">Has this issue been fixed? Upload a proof photo to earn +50 points.</p>
              
              {!isResolving ? (
                <button
                  onClick={() => setIsResolving(true)}
                  className="mt-2.5 w-full py-2 border border-beach-ocean/20 bg-beach-ocean/5 hover:bg-beach-ocean/10 text-beach-ocean font-bold text-xs rounded-xl transition-all"
                >
                  Submit Fix Proof Photo
                </button>
              ) : (
                <div className="space-y-3 mt-3 animate-fade-in">
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-2 border border-beach-cream bg-white hover:bg-beach-cream/10 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Camera className="w-4 h-4" /> Upload Fix Photo
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleResolveProofUpload}
                      className="hidden"
                    />
                  </div>

                  {resolveMedia && (
                    <div className="space-y-2.5">
                      <img 
                        src={resolveMedia} 
                        alt="Resolution Proof" 
                        className="h-28 w-full object-cover rounded-xl border border-beach-cream" 
                        referrerPolicy="no-referrer"
                      />
                      <button
                        onClick={handleVerifyResolution}
                        disabled={isVerifyingFix}
                        className="w-full py-2.5 bg-beach-ocean hover:bg-beach-ocean/90 text-white font-bold text-xs rounded-xl transition-all shadow-md"
                      >
                        {isVerifyingFix ? 'Verifying with Gemini AI...' : 'Verify Fix & Resolve'}
                      </button>
                    </div>
                  )}

                  {fixVerdict && (
                    <p className={`text-xs font-bold p-2.5 rounded-xl border text-center ${
                      fixVerdict.startsWith('Success') 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-700'
                    }`}>
                      {fixVerdict}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Calendar ICS Export */}
          <button
            onClick={() => generateICSFile(issue)}
            className="w-full py-2 border border-beach-cream bg-white hover:bg-beach-cream/30 text-xs font-semibold text-slate-500 hover:text-slate-700 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <Calendar className="w-4 h-4 text-beach-coral" /> 
            <span>Download Recheck Reminder (.ics)</span>
          </button>

          {/* Google Workspace Integration Actions */}
          {accessToken ? (
            <div className="bg-white border border-beach-cream shadow-sm p-4 rounded-2xl text-left space-y-4">
              <div className="flex justify-between items-center border-b border-beach-cream/30 pb-2">
                <h4 className="text-xs font-black text-beach-driftwood uppercase tracking-wider flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin-slow animate-spin" /> Google Workspace Actions
                </h4>
                <span className="text-[8px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-0.5 font-bold rounded-full">
                  Connected
                </span>
              </div>

              {/* Grid of basic quick functions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportToDocs}
                  disabled={isWorkspaceActionLoading}
                  className="p-2 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-xl text-[10px] font-bold text-blue-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>Quick Case Doc</span>
                </button>
                
                <button
                  onClick={handleExportToSheets}
                  disabled={isWorkspaceActionLoading}
                  className="p-2 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] font-bold text-emerald-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <TableProperties className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Ward Sheets DB</span>
                </button>
              </div>

              {/* FEATURE 2: CIVIC PETITION DRAFTER (Gemini-powered + Google Doc integration) */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-3 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">✍️</span>
                  <div>
                    <h5 className="text-[11px] font-bold text-slate-800">AI Civic Petition Drafter</h5>
                    <p className="text-[9px] text-slate-500">Draft formal letters using Gemini, then export to Google Docs.</p>
                  </div>
                </div>

                {!petitionText ? (
                  <button
                    onClick={handleDraftPetition}
                    disabled={isDrafting}
                    className="w-full py-2 bg-gradient-to-r from-beach-coral to-beach-coral/95 hover:brightness-105 text-white text-[10px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer border-none"
                  >
                    {isDrafting ? (
                      <>
                        <Loader className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Nano is drafting petition...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                        <span>Generate Petition with Gemini AI</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2.5">
                    <label className="text-[9px] font-bold text-slate-500 block">Review & Edit Draft:</label>
                    <textarea
                      value={petitionText}
                      onChange={(e) => setPetitionText(e.target.value)}
                      className="w-full h-32 bg-white text-slate-700 border border-beach-cream rounded-xl p-2.5 text-[10px] font-mono leading-relaxed outline-none focus:border-beach-coral/50"
                    />
                    
                    <div className="flex gap-2">
                      <button
                        onClick={handleDraftPetition}
                        disabled={isDrafting}
                        className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-250 text-slate-700 text-[9px] font-bold rounded-lg border border-slate-200 transition-all cursor-pointer"
                      >
                        Re-draft
                      </button>
                      <button
                        onClick={handleExportPetitionDoc}
                        disabled={isExportingPetition}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none"
                      >
                        {isExportingPetition ? (
                          <>
                            <Loader className="w-3 h-3 animate-spin text-white" />
                            <span>Exporting...</span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5 text-white" />
                            <span>Export to Docs</span>
                          </>
                        )}
                      </button>
                    </div>

                    {exportedPetitionUrl && (
                      <a
                        href={exportedPetitionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center py-2 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-1"
                      >
                        <span>Open Document on Google Docs</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}
                {petitionError && (
                  <p className="text-[9px] text-rose-600 italic bg-rose-50 p-1.5 rounded border border-rose-100">{petitionError}</p>
                )}
              </div>

              {/* FEATURE 3: GOOGLE MEET MOBILIZATION SCHEDULER */}
              <div className="bg-sky-50/30 border border-sky-100 rounded-xl p-3.5 space-y-3 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">📣</span>
                  <div>
                    <h5 className="text-[11px] font-bold text-slate-800">Google Meet Rally Scheduler</h5>
                    <p className="text-[9px] text-slate-500">Plan a coordination meeting with an auto-generated Meet link.</p>
                  </div>
                </div>

                {!scheduledMeetResult ? (
                  <div className="space-y-2.5 text-left">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 block">Meeting Date & Time:</label>
                      <input
                        type="datetime-local"
                        value={meetingDateTime}
                        onChange={(e) => setMeetingDateTime(e.target.value)}
                        className="w-full bg-white text-slate-700 border border-beach-cream rounded-xl px-2.5 py-1.5 text-[10px] font-medium outline-none focus:border-sky-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 block">Agenda & Notes:</label>
                      <textarea
                        value={meetingNotes}
                        onChange={(e) => setMeetingNotes(e.target.value)}
                        className="w-full h-20 bg-white text-slate-700 border border-beach-cream rounded-xl p-2.5 text-[10px] leading-normal outline-none focus:border-sky-400"
                      />
                    </div>

                    <button
                      onClick={handleScheduleCommunityMeetAction}
                      disabled={isSchedulingMeet}
                      className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer border-none"
                    >
                      {isSchedulingMeet ? (
                        <>
                          <Loader className="w-3.5 h-3.5 animate-spin text-white" />
                          <span>Generating Google Meet...</span>
                        </>
                      ) : (
                        <>
                          <CalendarDays className="w-3.5 h-3.5 text-white" />
                          <span>Schedule Google Meet Rally</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 text-left">
                    <div className="bg-emerald-50 border border-emerald-150 p-2.5 rounded-xl">
                      <p className="text-[10px] text-emerald-800 font-bold">🎉 Rally successfully scheduled!</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Google Meet link attached & saved to your Google Calendar.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={scheduledMeetResult.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold flex flex-col items-center justify-center text-center gap-1 transition-all"
                      >
                        <span className="text-base leading-none">📹</span>
                        <span className="mt-1">Join Google Meet</span>
                      </a>
                      <a
                        href={scheduledMeetResult.eventLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center text-center gap-1 transition-all"
                      >
                        <CalendarDays className="w-4 h-4 text-blue-500" />
                        <span className="mt-1">Google Calendar</span>
                      </a>
                    </div>
                  </div>
                )}
                {meetError && (
                  <p className="text-[9px] text-rose-600 italic bg-rose-50 p-1.5 rounded border border-rose-100">{meetError}</p>
                )}
              </div>

              {/* Keep, Tasks and Chat spaces */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCreateTask}
                    disabled={isWorkspaceActionLoading}
                    className="p-2 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 rounded-xl text-[10px] font-bold text-indigo-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Save Google Task</span>
                  </button>

                  <button
                    onClick={handleSaveKeepNote}
                    disabled={isWorkspaceActionLoading}
                    className="p-2 bg-amber-50/30 hover:bg-amber-50/50 border border-amber-150 rounded-xl text-[10px] font-bold text-amber-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileEdit className="w-3.5 h-3.5 text-amber-500" />
                    <span>Dispatch Keep Note</span>
                  </button>
                </div>

                {/* Chat spaces */}
                <div className="pt-2.5 border-t border-slate-100 space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                    Google Chat Dispatch System
                  </label>
                  {isChatSpacesLoading ? (
                    <p className="text-[10px] text-slate-400 italic flex items-center gap-1.5">
                      <Loader className="w-3 h-3 animate-spin" /> Loading readable Chat spaces...
                    </p>
                  ) : chatSpaces.length > 0 ? (
                    <div className="space-y-1.5">
                      <select
                        value={selectedSpaceName}
                        onChange={(e) => setSelectedSpaceName(e.target.value)}
                        className="w-full bg-white text-slate-700 border border-beach-cream rounded-xl px-2.5 py-1.5 text-[10px] font-medium outline-none"
                      >
                        {chatSpaces.map(space => (
                          <option key={space.name} value={space.name}>
                            {space.displayName || space.name.replace('spaces/', 'Space ')}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleSendChatAlert}
                        disabled={isWorkspaceActionLoading || !selectedSpaceName}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm border-none"
                      >
                        <MessageSquareShare className="w-3.5 h-3.5" /> Dispatch Alert Warning
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic leading-relaxed">
                      No active Google Chat spaces identified for your account. Ensure you are added to spaces.
                    </p>
                  )}
                </div>
              </div>

              {/* Loader */}
              {isWorkspaceActionLoading && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center gap-2 animate-pulse">
                  <Loader className="w-4 h-4 text-beach-ocean animate-spin" />
                  <span className="text-[10px] font-bold text-slate-500">Executing Workspace dispatch...</span>
                </div>
              )}

              {/* Feedback Success */}
              {workspaceActionFeedback && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-150 rounded-xl space-y-2 text-left animate-fade-in">
                  <p className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" /> {workspaceActionFeedback}
                  </p>
                  {workspaceActionLink && (
                    <a
                      href={workspaceActionLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer text-center"
                    >
                      Open Created Google Asset <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Error */}
              {workspaceActionError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-left animate-fade-in">
                  <p className="text-[10px] font-semibold text-rose-700">
                    ⚠️ Error: {workspaceActionError}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-left space-y-2.5">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                <RefreshCw className="w-4 h-4 text-slate-400" /> Google Workspace Actions
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Connect your Google Account inside the <b>Passport (Profile)</b> tab to activate live Google Drive case folders, Sheet database sync, Calendar inspector scheduling, and Chat space dispatch notifications for this issue.
              </p>
            </div>
          )}

          {/* Nano Autonomous Resolution Agent Panel */}
          <ResolutionAgentPanel
            issue={issue}
            recentIssues={recentIssues}
            currentUser={currentUser}
            accessToken={accessToken}
            onUpdateIssue={onUpdateIssue}
            onAddCommentLocal={onAddCommentLocal}
          />

          {/* Comments Discussion Section */}
          <div className="pt-4 border-t border-beach-cream/60 space-y-3">
            <h4 className="text-xs font-bold text-beach-driftwood flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-beach-coral" /> Citizens discussion ({comments.length})
            </h4>
            
            {/* Scrollable list of comments */}
            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {comments.map(c => (
                <div 
                  key={c.id} 
                  className={`p-2.5 rounded-xl border ${
                    c.isAI 
                      ? 'bg-sky-500/5 border-sky-500/10 text-slate-700' 
                      : 'bg-beach-cream/30 border-beach-cream/50 text-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      {c.isAI ? (
                        <Sparkles className="w-3 h-3 text-beach-ocean animate-pulse" />
                      ) : (
                        <User className="w-3 h-3 text-slate-400" />
                      )}
                      {c.userName}
                    </span>
                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed text-slate-700">{c.text}</p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-[10px] text-slate-400 italic text-center py-2">Start discussion. Type "@AI" to query Nano AI.</p>
              )}
            </div>

            {/* Send comment form */}
            <form onSubmit={handleSubmitComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ask neighbor or start with '@AI' for Nano..."
                className="flex-1 bg-white text-slate-800 placeholder-slate-400 border border-beach-cream rounded-xl px-3.5 py-2 text-xs outline-none focus:border-beach-coral focus:ring-1 focus:ring-beach-coral transition-colors"
              />
              <button
                type="submit"
                disabled={isAiLoading}
                className="p-2 bg-beach-coral text-white hover:bg-beach-coral/95 rounded-xl shadow-sm flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
