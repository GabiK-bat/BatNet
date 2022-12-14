# checking if required packages are installed (install if not) and load them
if(!("stringr" %in% installed.packages()[,1])) install.packages("stringr")
library(stringr)

# Version 02.03.2020
# NEW:
# dates.between() -> creates vector with every date between given dates (including these dates itselfe)
# date.next() -> gives back date of next day
# date.previous() -> gives back date of previous day
# CHANGES:
# every.date.year() now vectorized

##############################################################################################################
############# Variables and Functions ########################################################################
##############################################################################################################

# variables used for some functions
dperM = c(31,28,31,30,31,30,31,31,30,31,30,31)
dperMM = matrix(c(1:12,31,28,31,30,31,30,31,31,30,31,30,31),ncol=2)
dperMs = c(31,29,31,30,31,30,31,31,30,31,30,31)
dperMsM = matrix(c(1:12,31,29,31,30,31,30,31,31,30,31,30,31),ncol=2)
dperY = rep(c(365,365,365,366),550)



# creates vector with every date in given year
every.date.year = function(year,sep=".",format=c("d","m","y"))
{
  alldays = NULL
  for(cyear in year)
  {
    if(dperY[cyear]==365) 
    {
      m = unlist(apply(dperMM,1,function(x) rep(x[1],x[2])))
      d = unlist(lapply(dperMM[,2],function(x) 1:x)) }
    else 
    {
      m = unlist(apply(dperMsM,1,function(x) rep(x[1],x[2])))
      d = unlist(lapply(dperMsM[,2],function(x) 1:x)) }
    y = rep(cyear,dperY[cyear])
    ds = cbind(d,m,y)
    ds = apply(ds,2,function(x) str_pad(x,2,"left","0"))
    alldays = c(alldays,apply(ds[,format],1,function(x)paste(x,collapse=sep)))
  }
  return(alldays)
}

# creates vector with every date between given dates (including these dates itselfe)
dates.between = function(date.from,date.to,sep="\\.",format=c("d","m","y"),cent="20")
{
  fromS = split.date(date.from,sep=sep,format=format,cent=cent)
  toS = split.date(date.to,sep=sep,format=format,cent=cent)
  alldaysyears = every.date.year(unique(as.numeric(as.vector(fromS$year)):as.numeric(as.vector(toS$year))),format=format)
  chompStart = days.year.passed(date.from,sep=sep,format=format,cent=cent)
  chompEnd = days.year.coming(date.to,sep=sep,format=format,cent=cent)
  return(alldaysyears[chompStart:(length(alldaysyears)-chompEnd+1)])
}

# gives back date of next day
date.next = function(date,sep="\\.",format=c("d","m","y"),cent="20")
{
  coming = days.year.coming(date,sep=sep,format=format,cent=cent)
  if(coming == 1)
  {
    alldaysyear = every.date.year(as.numeric(as.vector(split.date(date,sep=sep,format=format)$year))+1)
    return(alldaysyear[1]) }
  else
  {
    alldaysyear = every.date.year(as.numeric(as.vector(split.date(date,sep=sep,format=format)$year)))
    return(alldaysyear[length(alldaysyear)-coming+2]) }
}

# gives back date of previous day
date.previous = function(date,sep="\\.",format=c("d","m","y"),cent="20")
{
  passed = days.year.passed(date,sep=sep,format=format,cent=cent)
  if(passed == 0)
  {
    alldaysyear = every.date.year(as.numeric(as.vector(split.date(date,sep=sep,format=format)$year))-1)
    return(alldaysyear[length(alldaysyear)]) }
  else
  {
    alldaysyear = every.date.year(as.numeric(as.vector(split.date(date,sep=sep,format=format)$year)))
    return(alldaysyear[passed]) }
}

# splits dates of the given formates (sep,format) to seperate columns of a dataframe (or merges them again for sorting)
split.date = function(date,sep="\\.",format=c("d","m","y"),cent="20",merge=F)
{
  ord = c("d"=1,"m"=2,"y"=3)
  rows=1:length(date) #to later filter possible data ducplications (see comment below)
  if(length(date)==1) date = c(date,date) #neccessary to temporarily duplicate, because apply needs at least 2 rows after splitting
  dateS = matrix(unlist(strsplit(date,split=sep)),ncol=3,byrow=T)[,ord[format]]
  dateS = apply(dateS,2,function(x) str_pad(x,2,"left","0")) #adding leading zeros in front of day and month
  if(nchar(dateS[1,3])==2) dateS[,3] = paste(cent,dateS[,3],sep="")
  if(merge) {dateS = apply(dateS[,3:1],1,function(x) paste(x,collapse="")); return(dateS[rows])} # returns vector of the merged dates to use for sorting 
  else {dateS = as.data.frame(dateS); names(dateS) = c("day","month","year"); return(dateS[rows,])} # returns dataframe with day, month and year
}


# reformates dates from given seperator (sep) and format to given to.sep and to.format
reformat.date = function(date,sep="\\.",format=c("d","m","y"),to.sep="/",to.format=c("y","m","d"),cent="20")
{
  ord = c("d"=1,"m"=2,"y"=3)
  dateS = split.date(date,sep=sep,format=format,cent=cent)
  return(apply(dateS[,ord[to.format]],1,function(x) paste(x,collapse=to.sep)))
}


# calculates how many days have passed in the current year (date itself is counted as not passed)
days.year.passed = function(date,sep="\\.",format=c("d","m","y"),cent="20")
{
  dateS = split.date(date,sep=sep,format=format,cent=cent)
  dateS[] = lapply(dateS, function(x) as.numeric(as.vector(x)))
  days = NULL
  for(i in 1:length(date))
  {
    if(dperY[dateS$year[i]]==365) {days = c(days,ifelse(dateS$month[i]==1,0,sum(dperM[1:(dateS$month[i]-1)])) + dateS$day[i]-1)}
    else {days = c(days,ifelse(dateS$month[i]==1,0,sum(dperMs[1:(dateS$month[i]-1)])) + dateS$day[i]-1)}
  }
  return(days)
}


# calculates how many days of the current year are remaining (date itself is counted to the remaining)
days.year.coming = function(date,sep="\\.",format=c("d","m","y"),cent="20")
{
  dateS = split.date(date,sep=sep,format=format,cent=cent)
  dateS[] = lapply(dateS, function(x) as.numeric(as.vector(x)))
  days = NULL
  for(i in 1:length(date)) {days = c(days, dperY[dateS$year[i]] - days.year.passed(date[i],sep=sep,format=format,cent=cent))}
  return(days)
}


# calculates number of days passed since a reference date
# IMPORTANT: dates and referecne need to have same formatting 
days.since = function(date,reference,sep="\\.",format=c("d","m","y"),cent="20")
{
  dateS = split.date(date,sep=sep,format=format,cent=cent) # split dates
  dateS[] = lapply(dateS, function(x) as.numeric(as.vector(x)))
  referenceS = split.date(reference,sep=sep,format=format,cent=cent) # split reference date
  referenceS[] = lapply(referenceS, function(x) as.numeric(as.vector(x)))
  refI = rep(1:length(reference),ceiling(length(date)/length(reference)))
  days = NULL
  for(i in 1:length(date))
  { 
    dy = ifelse(dateS$year[i]==referenceS$year[refI[i]],0,sum(dperY[referenceS$year[refI[i]]:(dateS$year[i]-1)]))
    days = c(days, abs(dy - days.year.passed(reference[refI[i]],sep=sep,format=format,cent=cent) + days.year.passed(date[i],sep=sep,format=format,cent=cent)))
  }
  return(days)
}


#splits times of the given formates (sep,format) to seperate columns of a dataframe (or merges them again for sorting)
#works like split.date, but better in handling missing formats like hour or second
split.time = function(time,sep=":",format=c("h","m","s"),merge=F)
{
  ord = 1:length(format)
  names(ord) = c("h","m","s")[c("h","m","s") %in% format]
  nam = c("hour","minute","second")[c("h","m","s") %in% format]
  rows=1:length(time) #to later filter possible data ducplications (see comment below)
  if(length(time)==1) time = c(time,time) #neccessary to temporarily duplicate, because apply needs at least 2 rows after splitting
  timeS = matrix(unlist(strsplit(time,split=sep)),ncol=length(ord),byrow=T)[,ord]
  timeS = apply(timeS,2,function(x) str_pad(x,2,"left","0")) #adding leading zeros in front of hour, minute and second
  if(merge) {timeS = apply(timeS,1,function(x) paste(x,collapse="")); return(timeS[rows])} # returns vector of the merged dates to use for sorting 
  else {timeS = as.data.frame(timeS); names(timeS) = nam; return(timeS[rows,])} # returns dataframe with day, month and year
}


#calculates difference of time to reference time 
time.since = function(time,reference,sep=":",format=c("h","m","s"),in.seconds=F)
{
  timeS = to.second(time)
  referenceS = to.second(reference)
  refI = rep(1:length(reference),ceiling(length(time)/length(reference)))
  seconds = NULL
  for(i in 1:length(time))
  {
    if(timeS[i] >= referenceS[refI[i]]) {seconds = c(seconds,timeS[i]-referenceS[refI[i]])}
    else {seconds = c(seconds,86400-referenceS[refI[i]]+timeS[i])}
  }
  if(in.seconds) {return(seconds)}
  else {return(to.time(seconds,sep=sep))}
}


#calculates difference of time and date to reference time and date  
time.date.since = function(time,date,reference.time,reference.date,sep.time=":",sep.date="\\.",format.time=c("h","m","s"),format.date=c("d","m","y"),cent=20,in.seconds=T)
{
  dSi = days.since(date,reference=reference.date,sep=sep.date,format=format.date,cent=cent)
  timeS = to.second(time)
  referenceS = to.second(reference.time)
  refI = rep(1:length(reference.time),ceiling(length(time)/length(reference.time)))
  seconds = NULL
  for(i in 1:length(time))
  {
    if(dSi[i] == 0) {seconds = c(seconds,timeS[i]-referenceS[refI[i]])}
    else {seconds = c(seconds,dSi*86400-referenceS[refI[i]]+timeS[i])}
  }
  if(in.seconds) {return(seconds)}
  else {return(to.time(seconds,sep=sep))}
}
  
  
# converts time to decimal hours
to.hour = function(time,sep=":",format=c("h","m","s"))
{
  timeS = split.time(time,sep=sep,format=format)
  timeS[] = lapply(timeS, function(x) as.numeric(as.vector(x)))
  vars = names(timeS)
  sec = 0
  if("hour" %in% vars) sec = timeS$hour
  if("minute" %in% vars) sec = sec + timeS$minute / 60
  if("second" %in% vars) sec = sec + timeS$second / 3600
  return(sec)
}

# converts time to decimal minutes
to.minute = function(time,sep=":",format=c("h","m","s"))
{
  timeS = split.time(time,sep=sep,format=format)
  timeS[] = lapply(timeS, function(x) as.numeric(as.vector(x)))
  vars = names(timeS)
  min = 0
  if("hour" %in% vars) min = timeS$hour * 60
  if("minute" %in% vars) min = min + timeS$minute
  if("second" %in% vars) min = min + timeS$second / 60
  return(min)
}

# converts time to decimal minutes
to.second = function(time,sep=":",format=c("h","m","s"))
{
  timeS = split.time(time,sep=sep,format=format)
  timeS[] = lapply(timeS, function(x) as.numeric(as.vector(x)))
  vars = names(timeS)
  sec = 0
  if("hour" %in% vars) sec = timeS$hour * 3600
  if("minute" %in% vars) sec = sec + timeS$minute * 60
  if("second" %in% vars) sec = sec + timeS$second
  return(sec)
}

to.time = function(time,type="s",sep=":",with.sec=T)
{
  if(type=="s")
  {
    h = time %/% 3600
    if(with.sec)
    {
      m = (time%%3600) %/% 60
      s = (time%%3600)%%60
      t = paste(h,m,s,sep=sep)
      return(paste(str_pad(h,2,"left","0"),str_pad(m,2,"left","0"),str_pad(s,2,"left","0"),sep=sep))
    }
    else
    {
      m = round((time%%3600) / 60)
      t = paste(h,m,sep=sep)
      return(paste(h,m,sep=sep))
      }
  }
  else if(type=="m")
  {
    h = time %/% 60
    m = (time%%60) %/% 1
    s = round(((time%%60)%%1) * 60)
    return(paste(h,m,s,sep=sep))
  }
  else if (type=="h")
  {
    h = time %/% 1
    m = round((time%%1) %/% (1/60))
    s = round(((time%%1)%%(1/60)) * 3600)
    return(paste(h,m,s,sep=sep))
  }
  else {cat("Error: unrecognized type! Please specify 's' = seconds, 'm' = minutes or 'h' = hours\n")}
}

##############################################################################################################
############# Testing Section ################################################################################
##############################################################################################################

#date test
#data for testing purposes
testdate = "03.04.2017"
testdates = c("03.04.2017","05.06.2018","23.09.2019")
testdatesS = c("03.04.17","05.06.18","23.09.19") #functions shoud automatically add the 20 in front of the year
testdatesR = c("2017/04/03","2018/06/05","2019/09/23") #functions need specification regarding separator and order of y m d 

split.date(testdate)
split.date(testdates)
split.date(testdatesS)
split.date(testdatesR,sep="/",format=c("y","m","d"))
split.date("2015/03/01",sep="/",format=c("y","m","d"))

reformat.date(testdate)
reformat.date(testdates)
reformat.date(testdatesS)
reformat.date(testdatesR,sep="/",format=c("y","m","d"),to.sep=".",to.format=c("d","m","y"))
reformat.date("2015/03/01",sep="/",format=c("y","m","d"),to.sep=".",to.format=c("d","m","y"))
reformat.date("15/03/01",sep="/",format=c("y","m","d"),to.sep=".",to.format=c("d","m","y"))

days.year.passed(testdate)
days.year.passed(testdates)
days.year.passed(testdatesS)
days.year.passed(testdatesR,sep="/",format=c("y","m","d"))
days.year.passed("2015/03/01",sep="/",format=c("y","m","d"))

days.year.coming(testdate)
days.year.coming(testdates)
days.year.coming(testdatesS)
days.year.coming(testdatesR,sep="/",format=c("y","m","d"))
days.year.coming("2015/03/01",sep="/",format=c("y","m","d"))

days.since(testdate,reference="01.01.2015")
days.since(testdates,reference="01.01.2015")
days.since(testdates,reference=c("01.01.2015","01.01.2016","01.01.2017"))
days.since(testdatesS,reference="01.01.2015")
days.since(testdatesR,reference="2015/01/01",sep="/",format=c("y","m","d"))
days.since("2015/03/01",reference="2015/01/01",sep="/",format=c("y","m","d"))


# time test
#data for testing purposes
testtime = c("14:37:11")
testtimes = c("14:37:11","19:28:56","3:10:13")
testtimesS = c("14:37","19:28","03:10")

split.time(testtime)
split.time(testtimes)
split.time(testtimesS,format=c("m","s"))
split.time(testtimes,merge=T)
split.time(testtimesS,format=c("h","m"),merge=T)

to.hour(testtime)
to.hour(testtimes)
to.hour(testtimesS,format=c("h","m"))

to.minute(testtime)
to.minute(testtimes)
to.minute(testtimesS,format=c("h","m"))

to.second(testtime)
to.second(testtimes)
to.second(testtimesS,format=c("h","m"))

to.time(to.second(testtimes),type="s")
to.time(to.second(testtimes),type="s",with.sec=F)
to.time(to.minute(testtimes),type="m")
to.time(to.hour(testtimes),type="h",sep="")


# how to group into pseudo days:
# - calculate the days passed between the date of each registration and a common reference date -> days.since(VectorWithDates,reference=CommonReferenceDate,sep=...,format=...)
#     -> reference date should be set to at least 1 day before first registration
# - calculate the seconds passed since midnight for every time -> to.second(VectorWithTimes)
#     -> compare with cut-off times (should also be given in "seconds since midnight") to remove or associate to current, or next/previous "day since x" (calculated in first step)
#         -> pseudo-day! 

# generate random fake data to try
data = matrix(NA,ncol=3,nrow=0)
for(i in 1:100)
{
  tempT = to.time(runif(round(runif(1,1,20)),0,24),type="h")
  tempTs = split.time(as.vector(tempT),merge=T)
  tempT = tempT[order(as.numeric(as.vector(tempTs)))]
  tempD = rep(every.date.year(2020)[i],length(tempT))
  tempE = sample(c(1,-1),length(tempT),replace=T)
  data = rbind(data,cbind(tempD,apply(split.time(tempT),1,function(x)paste(x,collapse=":")),tempE))
}
data = data[-1,]
data = as.data.frame(data)
names(data) = c("date","time","event")
head(data)
# assume data as dataset for analysis

# distribute datapoints to pseudodates to represent groupings better; refday used as first step
data$refday = days.since(as.vector(data$date),reference="31.12.2019")
data$seconds = to.second(as.vector(data$time))
data$pseudoday = NA

morning = "06:00:00"
evening = "18:00:00"

for(i in 1:nrow(data))
{
  if(data$seconds[i] < to.second(morning)) data$pseudoday[i] = data$refday[i] - 1
  else if(data$seconds[i] > to.second(morning) & data$seconds[i] < to.second(evening)) data$pseudoday[i] = -1
  else data$pseudoday[i] = data$refday[i]
}

dataF = subset(data,data$pseudoday!=-1)
cat(nrow(data)-nrow(dataF)," datapoints removed from dataset\n")
head(dataF)
