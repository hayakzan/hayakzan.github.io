# Median of Two Sorted Arrays [under construction]

Here's a Java solution of a LeetCode problem I was recently working on, [Median of Two Sorted Arrays](https://leetcode.com/problems/median-of-two-sorted-arrays/). 

Let's quickly have a look at what median is in odd-numbered arrays (odd data) and even-numbered arrays (even data). 

For data $$x$$ of $$n$$ elements,
- if $$n$$ is odd, $$median(x) = x_{(n+1)/2}$$ 
 
- if $$n$$ is even, $$median(x) = \frac{x_{(n/2)} + x_{(n/2)+1}}{2} $$
  
If we were to take the brute force path and concatenate two arrays, we'd be able to directly use these equations. But the exercise is asking us to pursue `O(log (m+n))`, which means that option is out of scope (merging arrays and finding the median would be `O(n)+O(1) = O(n)`). So we have to find a way to do this with the given two arrays.

OK, let's see. First off, we need to scan through the arrays. We're going to do this based on the smallest array, in case `nums1` and `nums2` are not of equal size. `nums1` will be used for the rest of the algorithm, but if it's bigger than `nums2`, we will swap them using the help of a temp array so that we can keep using `nums1`.

```
class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
       if (nums1.length > nums2.length) { 
          int[] temp = nums1; 
          nums1 = nums2;
          nums2 = temp;          
          }
```
Now we can set the conditions on our [binary search ](https://www.youtube.com/watch?v=KXJSjte_OAI) algorithm. 
Here are the indices for beginning and end in `nums1` as well as the size of the combined array which will be useful later.

```
int lo = 0;
int hi = nums1.length;
int combLen = nums1.length + nums2.length;          
```
