# Median of Two Sorted Arrays

Here's a solution of a LeetCode problem I was working on, [Median of Two Sorted Arrays](https://leetcode.com/problems/median-of-two-sorted-arrays/).

Let's quickly have a look at what median is in odd-numbered arrays (odd data) and even-numbered arrays (even data). 

For data $$x$$ of $$n$$ elements,
- if $$n$$ is odd, $$median(x) = x_{(n+1)/2}$$
- if $$n$$ is odd, $$median(x) = \frac{x_{(n/2)} + x_{(n/2)+1}}{2} $$
  

If we have an odd array, then the correct place for our cursor will be a position where leftSide.length = rightSide.length + 1
 
