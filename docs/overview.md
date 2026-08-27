# Overview

### What?
GitHub but for tennis activity. 1 hour of playing tennis is the equivalent of 1 GitHub contribution.

### Why?
I want to track my tennis activity and see statistics like how many total hours and days I played tennis in the past year, which days/weeks/months I played the most tennis, who I've played the most tennis with, and where I've played the most tennis at. 

### How?
The simple approach would be manual input after each activity. This would include date, time, participants, (optional) YouTube URL, and maybe a short description.

> Alternatives might include importing from external sources or using APIs, like importing (tennis) activities from Google Calendar or parsing Strava (tennis) activities. However, the original action for tracking might still be manual input (unless it's automated like a Strava activity being recorded on a fitness watch device).

### Who?
Primarily me, but also for anyone who wants to track their tennis activity.

## Functionality/Workflow
User: 
- workflow: log in &rarr; add activity &rarr; see activity on homepage
- without clicking any day/squares, the "Tennis activity" section below the grid will show a header with the current month ("August 2026") and a summary stat: "Played 25.5 hours in 10 sessions." 
- if a day/square is clicked, the "Tennis activity" section will show a header with the selected day ("August 15, 2026"), a subheader with a summary stat ("Played 4 hours in 2 session"), and a list of sessions.
    - each session will have its title as the main subheader with the hours beside the title. below it will include the participants and YT URL if it exists. 
    - similar to github's "Commit activity." The blue text repo name's equivalent is the tennis activity title.
- should be able to click on a singular day's activity and see quick notes on it (similar to GitHub's "Created 8 commits in 2 repositories" on click). 
- profiles will be public, so users can visit other pages to see tennis activity


Possible functions:
- export

Pages:
- login page
- home page
- logging activity: could be either a button on home page that pops up over the screen, or a separate page
- activity history in a certain timeframe (similar to commits with github)

## Design Inspiration
GitHub. Screenshots in the [images/](../images/) folder.

## Functionality Inspiration
GitHub. Strava may also have similar activity heatmap/distribution visualizations/features.