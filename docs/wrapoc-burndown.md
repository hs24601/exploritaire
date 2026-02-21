# WRAPOC SPA Burndown

## Todo
1. **Data specification** – capture every field that feeds gblChecklistData, including the pool collections and the locker-room logic, so the Flow payload mirrors what cntHtmPayloadSummary currently renders.
2. **Flow/data flow work** – extend the facility Compose logic so it pulls the same SharePoint columns, calculates the derived strings/booleans, and emits a JSON payload that the SPA template can consume.
3. **SPA template construction** – translate the mockup and existing HTML payloads into a single-page layout that recreates the header strip, facility snapshot, checklist sections, rating pills/checkboxes, summary bands, the theme toggle, and the download/print button.
4. **Integration & hosting** – decide if the SPA is returned directly in the Response action or hosted elsewhere, wire the Flow to render it per facility, and ensure any CSS/JS assets are reachable.
5. **Validation** – run the Flow for a representative facility, load the SPA response in a browser, and confirm the facility snapshot, restrooms/locker/emergency sections, toggles, and PDF/save-as behavior all match expectations.

## Task 1: Data specification
### Data sources that must be represented in the SPA payload
- gblSelectedFacility (the SharePoint Facilities list row) supplies every header text, restroom/locker count, and locker-use flag that the Canvas HTML references.
- galPools and colPools (the related pool gallery and its collection) provide the pool count (CountRows(galPools.AllItems)) and the comma-separated pool types (Concat(Distinct(colPools, Pool Type), Value, ", ")) that appear in the facility snapshot.
- gblChecklistData.LockerRoomSection collects the conditional lines and checkbox states for locker rooms and is built inside the Complete Generate Checklist button handler.
- gblDebugInfo.ShowGeneralUse is displayed inside the Locker Room card as the ""Facility Use Check"" indicator (typically ""YES"" when Facility Use equals ""General Use"").

### Payload schema requirements
#### Facility snapshot fields
| Field | Canvas expression | Notes |
| --- | --- | --- |
| FacilityName | gblSelectedFacility Facility Name column | Displayed in the page title, accordion header, and print banner. |
| Address | gblSelectedFacility Address column | |
| DOHFacility | gblSelectedFacility DOH Facility # column | |
| DOHProject | gblSelectedFacility DOH Project # column | |
| ProjectType | gblSelectedFacility Project Type column | |
| FacilityUse | gblSelectedFacility Facility Use column | Drives the locker room requirement rows and the general-use badge. |
| NumberOfPools | gblSelectedFacility ""# of Pools"" column (fallback to CountRows(galPools.AllItems)) | The Facilities card notes the field is absent, so compute it from the Pools list when necessary. |
| PoolTypes | Concat(Distinct(colPools, Pool Type), Value, ", ") | Deduplicate pool types shown in the informational card. |
| OpenHours | gblSelectedFacility Facility Open Hours column | |
| PlanApprovalDate | If(IsBlank(gblSelectedFacility Plan Approved Date), empty string, Text(..., mm/dd/yyyy)) | Format as mm/dd/yyyy just like the Canvas formula. |
| PlanApprovedBy | If(IsBlank(...), empty string, gblSelectedFacility Plan Approved By DisplayName) | Use the DisplayName of the person lookup. |

#### Infrastructure (Restrooms, Showers, and Plumbing)
| Field | Canvas expression | Notes |
| --- | --- | --- |
| ToiletCounts | Male: <# of Male Toilets>, Female: <# of Female Toilets>, Unisex: <# of Unisex Toilets> | Build a single string that mirrors the html row text. |
| UrinalCount | Male: <# of Urinals> | |
| SinkCounts | Male: <# of Male Sinks>, Female: <# of Female Sinks>, Unisex: <# of Unisex Sinks> | |
| ShowerCounts | Male: <# of Male Showers>, Female: <# of Female Showers>, Unisex: <# of Unisex Showers> | |
| HoseBibbLocation | gblSelectedFacility Hose Bibb Location column | |
| RestroomsBuiltPerPlan | (static text in Canvas) | Template can keep the pre-approved plan sentence; add a flag later if data becomes available. |
| FlushToiletDetails | (static text about flush toilets, warm water, mixing faucet, towels, and soap) | |
| ShowerTemperature | Shower temperature verified. ______ °F | Currently a placeholder; Flow can optionally fill a numeric value later. |

#### Locker Room and Dressing Rooms (General Use)
| Field | Canvas helper | Notes |
| --- | --- | --- |
| LockerRoomSection.NumberOfDressingRooms | Text(gblSelectedFacility ""# of Dressing Rooms"") | Show zero when blank. |
| LockerRoomSection.ShowGeneralUseRequirements | gblSelectedFacility Facility Use = ""General Use"" | Gate the additional rows. |
| LockerRoomSection.SeparateAreasLine | ""Separate areas provided by gender."" (only when general use) | SPA can render <em>HIDDEN</em> or omit the row otherwise. |
| LockerRoomSection.SeparateAreasS/CR/NA | Defaults are false | Prepare boolean props so future data can check the right boxes. |
| LockerRoomSection.NonSlipFloorsLine | ""The floors are non-slip and slope to a floor drain."" | |
| LockerRoomSection.CleanableSurfacesLine | ""The walls, floors, lockers and benches are easily cleanable."" | |
| LockerRoomSection.CovedEdgesLine | ""The edges are coved for easy cleaning."" | |
| LockerRoomSection.AnchoredLockersLine | ""The lockers anchored."" | |
| gblDebugInfo.ShowGeneralUse | Rendered as the small italic badge that currently displays YES | Flow should emit the same string (or bool) so the SPA can show that line. |

> Each locker row currently renders the three rating checkboxes in the Canvas HTML with no data-driven checks; return checkbox-state booleans only when they exist, so the SPA can keep them unchecked for now.

#### Emergency Equipment and Accessories
These rows use static text in the Canvas layout:
- Emergency telephone provided within aquatic facility
- Suitable area provided for person(s) requiring first aid treatment
- Standard 16 unit first aid kit with emergency blanket provided.

### Derived helpers & formatting notes
- PlanApprovalDate must be formatted as mm/dd/yyyy and blanked when the source column is empty.
- If the facility record does not expose the ""# of Pools"" column, derive NumberOfPools by counting the Pools list rows linked to the facility.
- PoolTypes should join the distinct Pool Type values from the Pools collection using , so the card matches the Canvas summary text.
- Expose FacilityUse and gblDebugInfo.ShowGeneralUse so the SPA can decide whether to render the locker room requirement rows and the italic info line.
- Locker room sections are conditional; when ShowGeneralUseRequirements is false, omit or collapse the rows so the layout matches the Canvas behavior.
- Make space for the rating pills/checkboxes (S/CR/NA) next to each checklist item, even if the Flow currently leaves them unchecked.
