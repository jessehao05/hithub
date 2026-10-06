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
    - considering using initials instead: [CT, GF, CK, PS, TP, IY, WB, MK, RL, SC, MLB, KS, LK, CH, MK, PS, RM, JK, O, S, JB, HT, JZ, VS, LP, AK, BJ, SB, JL, MT, AC, XH, DY, WW, RS, DT, KL, CZ, SK, RK, NN, SK, SS, RY, SK] for restricted
- YT: URL 
- Notes: string

### Requried Fields

- Name
- Date
- Minutes
- Location

### Optional Fields

- Partners
- YT
- Notes

## Other Notes

- Button for syncing notion data to web page? 
- Optimize to reduce number of fetching
    - Caching?