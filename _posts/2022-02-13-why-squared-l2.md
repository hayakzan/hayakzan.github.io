# Why squared $$L^2$$ norm over $$L^2$$ norm? [under construction]

In the Linear Algebra chapter of Goodfellow et al.'s brilliant [Deep Learning book](https://www.deeplearningbook.org/contents/linear_algebra.html), the following statement appears:

> The squared $$L^2$$ norm is more convenient to work with mathematically and computationally than the $$L^2$$ norm itself. For example, each derivative of the squared $$L^2$$ norm with respect to each element of $$\textbf{x}$$ depends only on the corresponding element of $$\textbf{x}$$, while all the derivatives of $$L^2$$ depend on the entire vector.

I wasn't quite sure about what is exactly referred here, so needed to dig in a bit. Hope this helps to some other learner looking for the same thing. 

The Euclidean norm, or $$L^2$$ norm can be expressed as follows:

<img width="629" alt="Screen Shot 2022-04-30 at 2 29 35 PM" src="https://user-images.githubusercontent.com/61164329/166123310-36dedcfc-7b62-4f22-b194-30957d57b031.png">

The derivative of it indeed depends on the entire vector, like this:

<img width="874" alt="Screen Shot 2022-04-30 at 2 29 06 PM" src="https://user-images.githubusercontent.com/61164329/166123322-bced7431-1d1c-42c9-b812-3de1caab1507.png">
