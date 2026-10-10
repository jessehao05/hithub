# Notion

Notion as a source for data.

## DB Name: tennis_activities

## Schema

- Name: string
    - "summer 24 tennis 1"
- Date: date
    - June 22, 2024
- Minutes: number
    - 120
- Location: select
    - [Concord Park, Saddle Ridge Courts, Fannie Mae Dees Park, McFee Park, Vanderbilt Indoor, Vanderbilt Outdoor, Carl Cowan Park, Wentworth Courts, Centennial Outdoor]
- Partners: multi-select
    - [Channing Tan, Grace Feng, Chris Keum, Priya Soneji, Thomas Pham, Iris Ye, Will Brown, Miles Kim, Roy Lau, Sunny Chen, Mario L Barrera, Kaan Sezgi, Leo King, Caleb Han, Manish Kota, Pauline Singer, Ryan Manley, Julio Kim, Ollie, Shane, Jimmy Baek, Harry Tran, Jennifer Zhang, Vivaan Singhvi, Lucas Poudyal, Addison Kim, Brian Jung, Sam Barbour, Jared Li, Manu Thomas, Alejandro Castillo, Lawrence Quimbo, Xinyi Hecen, Daniel Yoo, Priya's dad, Will Wu, Ruhaan Singh, DingDing Tan, Kevin Luo, Chloe Zhao, Shrish Kumar, Rohin Kumar, Nishan Nayak, Soheil Keshavarz, Sanjana Shrikanth, Ryan J, Shayna Kar]
    - hidden entirely in restricted mode; shown only after unlocking at `/unlock`
- YT: URL 
- Notes: string
    - not read by the app

### Required Fields

Rows missing either of these are skipped with a warning, since the grid can't place them.

- Date
    - keep "Include time" off
- Minutes

### Optional Fields

- Name (shown as "Untitled" if blank)
- Location
- Partners
- YT
- Notes

Renaming or retyping any property except Notes breaks the fetch with an error.

## Env

- `NOTION_TOKEN`: the integration's secret
- `NOTION_DATA_SOURCE_ID`: the data source ID, not the database ID

## Other Notes

- No sync button needed: every page load reads Notion directly
- Optimize to reduce number of fetching
    - Caching? Nothing caches yet; each request is one full fetch