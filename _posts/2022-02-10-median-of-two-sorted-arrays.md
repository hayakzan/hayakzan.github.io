# Median of Two Sorted Arrays [under construction]

Here's a solution of a LeetCode problem I was working on, [Median of Two Sorted Arrays](https://leetcode.com/problems/median-of-two-sorted-arrays/).

Let's quickly have a look at what median is in odd-numbered arrays (odd data) and even-numbered arrays (even data). 

For data $$x$$ of $$n$$ elements,
- if $$n$$ is odd, $$median(x) = x_{(n+1)/2}$$ 
 
- if $$n$$ is even, $$median(x) = \frac{x_{(n/2)} + x_{(n/2)+1}}{2} $$
  
If we were to take the brute force path and concatenate two arrays, we'd be able to directly use these equations. But the exercise is asking us to pursue `O(log (m+n))`, which means that option is out of scope (merging arrays and finding the median would be `O(n)+O(1) = O(n)`). So we have to find a way to do this with the given two arrays.

OK let's see. If we have `nums1 = [1,3]` and `nums2 = [2]`, how would we proceed? First intuition is to placing a cursor at the beginning of both arrays:
```
[_1,3]
[_2]
```
