# Iran province and city reference data

`iran_cities.json` contains the Persian province and canonical city names from
the Statistical Center of Iran's 1402 administrative snapshot. The source
dataset was published by
[MrAlfak/List-of-provinces-and-cities-of-Iran](https://github.com/MrAlfak/List-of-provinces-and-cities-of-Iran)
at commit `ae9cc635509f8e9568d8ec7f23e880f374d67b16`; that project documents its
upstream source as the Statistical Center of Iran and the pinned mirror
`sajaddp/list-of-cities-in-Iran` commit
`474942269f75ec247e1af5684f5e3eca9f304431`.

The checked-in file is a reduced derivative containing only province and city
names (31 provinces and 1,450 source entries, including three duplicate
province/city pairs; 1,447 unique cities are seeded). The dataset is licensed
under GPL-3.0; the complete license text is included as
`LICENSE-DATA-GPL-3.0`. This data license applies to this dataset and its
derivatives, not to unrelated application code.

The province-profile migration links each seeded province to its administrative
center in this city list. The source does not provide population, area,
coordinates, county-center classifications, or economic descriptions, so those
fields are left empty or unset rather than estimated. Editors should add
statistics and descriptions only after checking a reliable source.

Province-industry capacity records are managed from the Geography admin and
reference the shared Organizations industry catalog. Only published catalog
industries with published province profiles appear in the public API and
province pages. Production capacity, source citation, and update year remain
empty until entered by an editor with a verifiable source.
